import { Request, Response } from 'express';
import crypto from 'crypto';
import mongoose from 'mongoose';
import { env } from '../config/env.js';
import Booking from '../models/Booking.js';
import Operation from '../models/Operation.js';
import CustomerPayment from '../models/CustomerPayment.js';
import Enquiry from '../models/Enquiry.js';
import { sendConversionCongrats, sendBookingConfirmation, sendAdminNewBooking } from '../services/emailService.js';

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

  // ── 4. Only handle payment.captured ──────────────────────────────────────
  if (event !== 'payment.captured') {
    // Acknowledge other events without doing anything
    res.status(200).json({ status: 'ok', message: `Event ${event} acknowledged` });
    return;
  }

  // ── 5. Extract payment data ───────────────────────────────────────────────
  const paymentEntity = (payload.payload as Record<string, unknown>)?.payment as Record<string, unknown> | undefined;
  const entity = paymentEntity?.entity as Record<string, unknown> | undefined;

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

  // bookingId is stored in the order notes when we create the Razorpay order
  const notes = entity.notes as Record<string, string> | undefined;
  const bookingId = notes?.bookingId;

  if (!bookingId) {
    console.warn(`[WEBHOOK] payment.captured for order ${razorpayOrderId} — no bookingId in notes. Possibly a non-booking payment. Skipping.`);
    res.status(200).json({ status: 'ok', message: 'No bookingId — skipped' });
    return;
  }

  console.log(`[WEBHOOK] payment.captured — paymentId: ${razorpayPaymentId}, bookingId: ${bookingId}, amount: ₹${amountINR}`);

  try {
    // ── 6. Find the booking ────────────────────────────────────────────────
    const booking = await Booking.findById(bookingId);

    if (!booking) {
      console.error(`[WEBHOOK] Booking ${bookingId} not found`);
      // Still return 200 so Razorpay doesn't keep retrying
      res.status(200).json({ status: 'ok', message: 'Booking not found' });
      return;
    }

    // ── 7. Idempotency check ───────────────────────────────────────────────
    // If this payment ID is already in the history (browser verify ran first),
    // do nothing — prevents double-counting paidAmount.
    const alreadyRecorded = booking.paymentHistory.some(
      (p) => p.transactionId === razorpayPaymentId
    );

    if (alreadyRecorded) {
      console.log(`[WEBHOOK] Payment ${razorpayPaymentId} already recorded for booking ${bookingId} — skipping (idempotent)`);
      res.status(200).json({ status: 'ok', message: 'Already processed' });
      return;
    }

    // ── 8. Record payment ──────────────────────────────────────────────────
    booking.paymentHistory.push({
      amount: amountINR,
      method: 'razorpay',
      transactionId: razorpayPaymentId,
      date: new Date(),
      status: 'success',
    });

    // ── 9. Update paidAmount and derive paymentStatus ──────────────────────
    booking.paidAmount = (booking.paidAmount || 0) + amountINR;

    const wasConfirmed = booking.bookingStatus === 'confirmed';

    if (booking.paidAmount >= booking.totalAmount) {
      booking.paymentStatus = 'paid';
      if (booking.bookingStatus === 'pending') {
        booking.bookingStatus = 'confirmed';
      }
    } else {
      booking.paymentStatus = 'partial';
      // Even partial (deposit) payment confirms the trip
      if (booking.bookingStatus === 'pending') {
        booking.bookingStatus = 'confirmed';
      }
    }

    await booking.save();

    console.log(`[WEBHOOK] Booking ${bookingId} updated — paidAmount: ₹${booking.paidAmount}, paymentStatus: ${booking.paymentStatus}, bookingStatus: ${booking.bookingStatus}`);

    // ── 10. Respond to Razorpay immediately (before heavy async work) ──────
    res.status(200).json({ status: 'ok' });

    // ── 11. Auto-create Operation if booking just became confirmed ─────────
    const justConfirmed = !wasConfirmed && booking.bookingStatus === 'confirmed';

    if (justConfirmed) {
      try {
        const existingOp = await Operation.findOne({ booking: booking._id });
        if (!existingOp) {
          const populatedBooking = await Booking.findById(booking._id)
            .populate('package', 'name price')
            .populate('destination', 'name')
            .populate('user', 'firstName lastName email phone');

          if (populatedBooking) {
            const pkg = populatedBooking.package as unknown as { name?: string; price?: number; _id?: string };
            const dest = populatedBooking.destination as unknown as { name?: string };
            const usr = populatedBooking.user as unknown as { firstName?: string; lastName?: string; email?: string; phone?: string };
            const travellers = populatedBooking.travellers as { adults?: number; children?: number; infants?: number };
            const pax = (travellers?.adults || 1) + (travellers?.children || 0);

            // Send Booking Confirmations here
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

            const op = await Operation.create({
              booking: booking._id,
              package: pkg?._id || undefined,
              enquiry: populatedBooking.enquiry || undefined,
              customer: {
                name: usr ? `${usr.firstName || ''} ${usr.lastName || ''}`.trim() : 'Customer',
                email: usr?.email || '',
                phone: usr?.phone || '',
                pax,
                adults: travellers?.adults || 0,
                children: travellers?.children || 0,
              },
              destination: dest?.name || 'TBD',
              travelDates: {
                start: populatedBooking.travelDate,
                end: populatedBooking.returnDate || populatedBooking.travelDate,
              },
              sellingPrice: populatedBooking.totalAmount || 0,
              status: 'planning',
            });

            console.log(`[WEBHOOK] Operation auto-created for booking ${bookingId}`);

            // ── Auto-generate Customer Payments (Installments) ──
            const total = populatedBooking.totalAmount || 0;
            const paid = populatedBooking.paidAmount || 0;

            if (paid >= total && total > 0) {
              await CustomerPayment.create({
                operation: op._id,
                booking: booking._id,
                milestone: 'Full Payment (Paid Online)',
                amount: total,
                paidAmount: paid,
                status: 'paid',
              });
            } else if (paid > 0 && paid < total) {
              await CustomerPayment.create({
                operation: op._id,
                booking: booking._id,
                milestone: 'Advance Deposit (Paid Online)',
                amount: paid,
                paidAmount: paid,
                status: 'paid',
              });
              await CustomerPayment.create({
                operation: op._id,
                booking: booking._id,
                milestone: 'Balance Payment',
                amount: total - paid,
                paidAmount: 0,
                status: 'upcoming',
              });
            } else if (total > 0) {
              await CustomerPayment.create({
                operation: op._id,
                booking: booking._id,
                milestone: 'Full Payment Pending',
                amount: total,
                paidAmount: 0,
                status: 'upcoming',
              });
            }

            // ── 12. Sync linked enquiry → converted ────────────────────────
            if (populatedBooking.enquiry) {
              const linkedEnquiry = await Enquiry.findById(populatedBooking.enquiry)
                .populate('assignedTo', 'firstName lastName email');

              if (linkedEnquiry && linkedEnquiry.status !== 'converted') {
                linkedEnquiry.status = 'converted';
                linkedEnquiry.conversionValue = populatedBooking.totalAmount || 0;
                linkedEnquiry.bookingRef = booking._id as unknown as mongoose.Types.ObjectId;
                await linkedEnquiry.save();

                // Send congrats email to the assigned staff member (fire-and-forget)
                const assignedStaff = linkedEnquiry.assignedTo as unknown as { firstName: string; lastName?: string; email: string } | null;
                if (assignedStaff?.email) {
                  const customerName = `${linkedEnquiry.firstName} ${linkedEnquiry.lastName || ''}`.trim();
                  sendConversionCongrats(
                    assignedStaff.email,
                    `${assignedStaff.firstName} ${assignedStaff.lastName || ''}`.trim(),
                    customerName,
                    populatedBooking.totalAmount || 0
                  ).catch((err: unknown) => console.error('[WEBHOOK] Failed to send congrats email:', err));
                }

                console.log(`[WEBHOOK] Enquiry ${populatedBooking.enquiry} → converted`);
              }
            }
          }
        } else {
          console.log(`[WEBHOOK] Operation already exists for booking ${bookingId} — skipping`);
        }
      } catch (opErr) {
        // Log but don't throw — payment is already recorded, Operation creation is secondary
        console.error('[WEBHOOK] Error creating Operation:', opErr);
      }
    }
  } catch (err) {
    // If DB fails AFTER we already responded 200, Razorpay won't retry.
    // This is acceptable — the payment IS recorded in Razorpay's system.
    // The booking can be manually reconciled if needed.
    console.error('[WEBHOOK] Error processing payment.captured:', err);
  }
}
