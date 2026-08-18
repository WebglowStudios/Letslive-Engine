import { Request, Response } from 'express';
import crypto from 'crypto';
import mongoose from 'mongoose';
import { env } from '../config/env.js';
import Booking from '../models/Booking.js';
import Operation from '../models/Operation.js';
import CustomerPayment from '../models/CustomerPayment.js';
import { syncBookingPaymentToOperation } from '../utils/paymentSync.js';
import Enquiry from '../models/Enquiry.js';
import { autoCreateOperationFromBooking } from '../utils/operationBuilder.js';
import { sendBookingConfirmation, sendAdminNewBooking } from '../services/emailService.js';

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/webhooks/razorpay
//
// Razorpay calls this endpoint directly (server-to-server) when a payment is
// captured. This fires regardless of whether the customer's browser stays open,
// closing the race condition in the normal browser-based /payments/verify flow.
//
// IMPORTANT: This handler must receive the RAW body (not parsed by express.json)
// so we can verify the HMAC signature. The route mounts this with
// express.raw({ type: 'application/json' }) BEFORE express.json() in index.ts.
//
// Razorpay signature verification:
//   expectedSignature = HMAC-SHA256(rawBody, RAZORPAY_WEBHOOK_SECRET)
//   Compare to X-Razorpay-Signature header
// ─────────────────────────────────────────────────────────────────────────────

export async function razorpayWebhook(req: Request, res: Response): Promise<void> {
  const signature = req.headers['x-razorpay-signature'] as string | undefined;

  // ── 1. Always return 200 quickly to Razorpay (they retry on non-2xx) ──────
  // We do validation first but acknowledge fast.

  if (!signature) {
    console.warn('[WEBHOOK] Missing X-Razorpay-Signature header');
    res.status(400).json({ status: 'error', message: 'Missing signature' });
    return;
  }

  // ── 2. Verify HMAC-SHA256 signature ──────────────────────────────────────
  const webhookSecret = env.RAZORPAY_WEBHOOK_SECRET;

  if (!webhookSecret) {
    // If secret not configured, log a warning and accept gracefully in dev.
    // In production this should never happen — env validation would catch it.
    console.warn('[WEBHOOK] RAZORPAY_WEBHOOK_SECRET is not set — skipping signature verification (DEV ONLY)');
  } else {
    const rawBody = req.body as Buffer;
    const expectedSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(rawBody)
      .digest('hex');

    if (expectedSignature !== signature) {
      console.warn('[WEBHOOK] Signature mismatch — rejecting');
      res.status(400).json({ status: 'error', message: 'Invalid signature' });
      return;
    }
  }

  // ── 3. Parse the raw body now that signature is verified ─────────────────
  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse((req.body as Buffer).toString('utf8'));
  } catch {
    console.error('[WEBHOOK] Failed to parse body');
    res.status(400).json({ status: 'error', message: 'Invalid JSON body' });
    return;
  }

  const event = payload.event as string;
  console.log(`[WEBHOOK] Received event: ${event}`);

  // ── 4. Handle payment.captured OR payment_link.paid ─────────────────────
  const isPaymentCapture = event === 'payment.captured';
  const isPaymentLinkPaid = event === 'payment_link.paid';

  if (!isPaymentCapture && !isPaymentLinkPaid) {
    // Acknowledge other events without doing anything
    res.status(200).json({ status: 'ok', message: `Event ${event} acknowledged` });
    return;
  }

  // ── 5. Extract payment data ───────────────────────────────────────────────
  // payment.captured  → payload.payment.entity
  // payment_link.paid → payload.payment.entity (payment data) + payload.payment_link.entity (link data/notes)
  const paymentEntityWrapper = (payload.payload as Record<string, unknown>)?.payment as Record<string, unknown> | undefined;
  const entity = paymentEntityWrapper?.entity as Record<string, unknown> | undefined;

  // For payment_link.paid, notes are on the payment_link entity
  const paymentLinkEntityWrapper = (payload.payload as Record<string, unknown>)?.payment_link as Record<string, unknown> | undefined;
  const paymentLinkEntity = paymentLinkEntityWrapper?.entity as Record<string, unknown> | undefined;

  if (!entity) {
    console.error('[WEBHOOK] Malformed payload — no payment.entity');
    res.status(200).json({ status: 'ok', message: 'Malformed payload ignored' });
    return;
  }

  const razorpayPaymentId = entity.id as string;
  const razorpayOrderId = entity.order_id as string;
  // Razorpay amounts are in paise — convert to INR
  const amountPaise = entity.amount as number;
  const amountINR = Math.round(amountPaise / 100);

  // Notes: for payment_link.paid, the notes we set are on the payment_link entity
  // For payment.captured (order-based), notes are on the payment entity itself
  const linkNotes = paymentLinkEntity?.notes as Record<string, string> | undefined;
  const paymentNotes = entity.notes as Record<string, string> | undefined;
  const notes = linkNotes || paymentNotes;

  const bookingId = notes?.bookingId;
  const customerPaymentId = notes?.customerPaymentId;

  if (!bookingId && !customerPaymentId) {
    console.warn(`[WEBHOOK] ${event} for ${razorpayOrderId || razorpayPaymentId} — no bookingId or customerPaymentId in notes. Possibly a non-booking payment. Skipping.`);
    res.status(200).json({ status: 'ok', message: 'No target ID in notes — skipped' });
    return;
  }

  console.log(`[WEBHOOK] ${event} — paymentId: ${razorpayPaymentId}, bookingId: ${bookingId}, customerPaymentId: ${customerPaymentId}, amount: ₹${amountINR}, notes:`, JSON.stringify(notes));

  try {
    // ── 6. Handle Operation Installment Payment ────────────────────────────────
    if (customerPaymentId) {
      const cp = await CustomerPayment.findById(customerPaymentId);
      if (!cp) {
        console.error(`[WEBHOOK] CustomerPayment ${customerPaymentId} not found`);
        res.status(200).json({ status: 'ok', message: 'CustomerPayment not found' });
        return;
      }
      
      // Idempotency check for CustomerPayment
      if (cp.status === 'paid') {
        console.log(`[WEBHOOK] CustomerPayment ${customerPaymentId} already paid — skipping (idempotent)`);
        res.status(200).json({ status: 'ok', message: 'Already processed' });
        return;
      }

      // Mark CP as paid — Razorpay payment is auto-verified, no finance approval needed
      cp.status = 'paid';
      cp.transactionId = razorpayPaymentId;
      cp.paymentMode = 'razorpay';
      cp.paidAmount = amountINR;
      cp.paidDate = new Date();
      cp.financeStatus = 'approved'; // Online payment — auto-approved, skip finance queue
      // We don't save cp yet, we update Booking first to keep sync

      if (bookingId) {
        const booking = await Booking.findById(bookingId);
        if (booking) {
          booking.paymentHistory.push({
            amount: amountINR,
            method: 'razorpay',
            transactionId: razorpayPaymentId,
            date: new Date(),
            status: 'success',
          });
          booking.paidAmount = (booking.paidAmount || 0) + amountINR;
          
          if (booking.paidAmount >= booking.totalAmount) {
            booking.paymentStatus = 'paid';
          } else {
            booking.paymentStatus = 'partial';
          }
          await booking.save();
        }
      }

      await cp.save();
      console.log(`[WEBHOOK] CustomerPayment ${customerPaymentId} marked as paid`);
      res.status(200).json({ status: 'ok' });
      return;
    }

    // ── 7. Handle Direct Booking Payment ───────────────────────────────────────
    if (bookingId) {
      const booking = await Booking.findById(bookingId);

      if (!booking) {
        console.error(`[WEBHOOK] Booking ${bookingId} not found`);
        res.status(200).json({ status: 'ok', message: 'Booking not found' });
        return;
      }

      // Idempotency check
      const alreadyRecorded = booking.paymentHistory.some(
        (p) => p.transactionId === razorpayPaymentId
      );

      if (alreadyRecorded) {
        console.log(`[WEBHOOK] Payment ${razorpayPaymentId} already recorded for booking ${bookingId} — skipping (idempotent)`);
        res.status(200).json({ status: 'ok', message: 'Already processed' });
        return;
      }

      // Record payment
      booking.paymentHistory.push({
        amount: amountINR,
        method: 'razorpay',
        transactionId: razorpayPaymentId,
        date: new Date(),
        status: 'success',
      });

      // Update paidAmount and derive paymentStatus
      booking.paidAmount = (booking.paidAmount || 0) + amountINR;

      const wasConfirmed = booking.bookingStatus === 'confirmed';

      if (booking.paidAmount >= booking.totalAmount) {
        booking.paymentStatus = 'paid';
        if (booking.bookingStatus === 'pending') {
          booking.bookingStatus = 'confirmed';
        }
      } else {
        booking.paymentStatus = 'partial';
        if (booking.bookingStatus === 'pending') {
          booking.bookingStatus = 'confirmed';
        }
      }

      await booking.save();
      console.log(`[WEBHOOK] Booking ${bookingId} updated — paidAmount: ₹${booking.paidAmount}, paymentStatus: ${booking.paymentStatus}, bookingStatus: ${booking.bookingStatus}`);

      // Sync this payment to the Operation's installments if it exists
      await syncBookingPaymentToOperation(bookingId, amountINR, 'razorpay', razorpayPaymentId);

      // Respond to Razorpay immediately
      res.status(200).json({ status: 'ok' });

      // ── 11. Auto-create Operation if booking just became confirmed ─────────
      const justConfirmed = !wasConfirmed && booking.bookingStatus === 'confirmed';

      if (justConfirmed) {
        try {
          const populatedBooking = await Booking.findById(booking._id)
            .populate('package', 'name price')
            .populate('user', 'firstName lastName email phone');
            
          if (populatedBooking) {
            const pkg = populatedBooking.package as unknown as { name?: string };
            const usr = populatedBooking.user as unknown as { firstName?: string; lastName?: string; email?: string };
            const travellers = populatedBooking.travellers as { adults?: number; children?: number };
            const customerName = usr ? `${usr.firstName || ''} ${usr.lastName || ''}`.trim() : 'Customer';
            const adults = travellers?.adults || 1;
            const children = travellers?.children || 0;
            
            if (usr?.email) {
              sendBookingConfirmation(usr.email, usr.firstName || 'Customer', {
                bookingId: populatedBooking.bookingId || String(populatedBooking._id),
                packageName: pkg?.name || 'Package',
                travelDate: populatedBooking.travelDate
                  ? new Date(populatedBooking.travelDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
                  : 'TBD',
                amount: populatedBooking.totalAmount,
                travellers: `${adults} Adult${adults > 1 ? 's' : ''}${children ? `, ${children} Child${children > 1 ? 'ren' : ''}` : ''}`,
              }).catch((err) => console.error('[WEBHOOK] Failed to send booking confirmation:', err));
            }
        
            sendAdminNewBooking(
              customerName,
              pkg?.name || 'Package',
              populatedBooking.totalAmount,
              populatedBooking.travelDate
                ? new Date(populatedBooking.travelDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
                : 'TBD'
            ).catch((err) => console.error('[WEBHOOK] Failed to send admin booking notification:', err));
          }

          await autoCreateOperationFromBooking(booking._id);
          console.log(`[WEBHOOK] Operation auto-creation check passed for booking ${bookingId}`);
        } catch (opErr) {
          // Log but don't throw — payment is already recorded, Operation creation is secondary
          console.error('[WEBHOOK] Error creating Operation:', opErr);
        }
      }
    }
  } catch (err) {
    // If DB fails AFTER we already responded 200, Razorpay won't retry.
    // This is acceptable — the payment IS recorded in Razorpay's system.
    // The booking can be manually reconciled if needed.
    console.error('[WEBHOOK] Error processing payment.captured:', err);
  }
}
