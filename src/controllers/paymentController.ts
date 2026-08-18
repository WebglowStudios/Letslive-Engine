import { Request, Response } from 'express';
import crypto from 'crypto';
import Razorpay from 'razorpay';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { AppError } from '../middleware/errorHandler.js';
import { env } from '../config/env.js';
import Booking from '../models/Booking.js';
import Package from '../models/Package.js';
import User from '../models/User.js';
import { sendBookingConfirmation, sendAdminNewBooking } from '../services/emailService.js';
import { autoCreateOperationFromBooking } from '../utils/operationBuilder.js';

// Lazily initialise Razorpay so the server doesn't crash on boot if keys are missing
function getRazorpay(): Razorpay {
  if (!env.RAZORPAY_KEY_ID || !env.RAZORPAY_KEY_SECRET) {
    throw new AppError('Razorpay is not configured on this server', 503);
  }
  return new Razorpay({
    key_id: env.RAZORPAY_KEY_ID,
    key_secret: env.RAZORPAY_KEY_SECRET,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/payments/create-order
// Body: { bookingId, paymentType: 'full' | 'deposit' | 'balance' }
//
// Creates a Razorpay order for:
//   - 'full'    → charge totalAmount in one go
//   - 'deposit' → charge the configured deposit amount
//   - 'balance' → charge the outstanding balance (totalAmount - paidAmount)
// ─────────────────────────────────────────────────────────────────────────────
export const createOrder = asyncHandler(async (req: Request, res: Response) => {
  const { bookingId, paymentType = 'full' } = req.body as {
    bookingId: string;
    paymentType: 'full' | 'deposit' | 'balance';
  };

  if (!bookingId) throw new AppError('bookingId is required', 400);

  const booking = await Booking.findById(bookingId).populate('package');
  if (!booking) throw new AppError('Booking not found', 404);

  // Ownership check
  if (booking.user.toString() !== String(req.user!._id)) {
    throw new AppError('Not authorised', 403);
  }

  if (booking.paymentStatus === 'paid') {
    throw new AppError('This booking is already fully paid', 400);
  }

  const pkg = booking.package as unknown as {
    paymentConfig?: {
      mode: 'full' | 'partial';
      depositType: 'percent' | 'fixed';
      depositValue: number;
      depositLabel?: string;
      balanceDueDays?: number;
    };
  };

  const paymentConfig = pkg?.paymentConfig;
  const totalAmount = booking.totalAmount;
  const alreadyPaid = booking.paidAmount || 0;
  const outstanding = totalAmount - alreadyPaid;

  let chargeAmount: number;
  let receiptLabel: string;

  if (paymentType === 'deposit') {
    if (!paymentConfig || paymentConfig.mode !== 'partial') {
      throw new AppError('This package does not support deposit payments', 400);
    }
    if (alreadyPaid > 0) {
      throw new AppError('Deposit has already been paid', 400);
    }
    chargeAmount =
      paymentConfig.depositType === 'percent'
        ? Math.round((paymentConfig.depositValue / 100) * totalAmount)
        : paymentConfig.depositValue;
    receiptLabel = 'deposit';
  } else if (paymentType === 'balance') {
    if (outstanding <= 0) throw new AppError('No outstanding balance', 400);
    chargeAmount = outstanding;
    receiptLabel = 'balance';
  } else {
    // full
    chargeAmount = outstanding > 0 ? outstanding : totalAmount;
    receiptLabel = 'full';
  }

  if (chargeAmount <= 0) {
    throw new AppError('Charge amount must be greater than zero', 400);
  }

  const razorpay = getRazorpay();

  // Razorpay amounts are in paise (1 INR = 100 paise). Must be an integer.
  let order;
  try {
    order = await razorpay.orders.create({
      amount: Math.round(chargeAmount * 100),
      currency: 'INR',
      receipt: `${receiptLabel}-${String(booking._id).slice(-8)}`,
      notes: {
        bookingId: String(booking._id),
        internalBookingId: booking.bookingId || '',
        paymentType: receiptLabel,
        userId: String(req.user!._id),
      },
    });
  } catch (rzpErr) {
    console.error("[Razorpay Error] orders.create failed:", rzpErr);
    throw new AppError('Failed to initiate Razorpay order', 500);
  }

  res.status(200).json({
    status: 'success',
    data: {
      orderId: order.id,
      amount: chargeAmount,         // in INR for display
      amountPaise: chargeAmount * 100,
      currency: 'INR',
      keyId: env.RAZORPAY_KEY_ID,
      bookingId: String(booking._id),
      internalBookingId: booking.bookingId,
      paymentType: receiptLabel,
    },
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/payments/verify
// Body: { razorpay_order_id, razorpay_payment_id, razorpay_signature,
//         bookingId, paymentType, amount }
// ─────────────────────────────────────────────────────────────────────────────
export const verifyPayment = asyncHandler(async (req: Request, res: Response) => {
  const {
    razorpay_order_id,
    razorpay_payment_id,
    razorpay_signature,
    bookingId,
    paymentType,
    amount, // in INR
  } = req.body as {
    razorpay_order_id: string;
    razorpay_payment_id: string;
    razorpay_signature: string;
    bookingId: string;
    paymentType: 'full' | 'deposit' | 'balance';
    amount: number;
  };

  // 1. Verify HMAC signature
  const body = razorpay_order_id + '|' + razorpay_payment_id;
  const expectedSignature = crypto
    .createHmac('sha256', env.RAZORPAY_KEY_SECRET)
    .update(body)
    .digest('hex');

  if (expectedSignature !== razorpay_signature) {
    throw new AppError('Payment verification failed — invalid signature', 400);
  }

  // 2. Find and update booking
  const booking = await Booking.findById(bookingId).populate('package').populate('user');
  if (!booking) throw new AppError('Booking not found', 404);

  const usr = booking.user as unknown as { _id: string; firstName?: string; lastName?: string; email?: string; phone?: string };
  if (usr._id.toString() !== String(req.user!._id)) {
    throw new AppError('Not authorised', 403);
  }

  // 3. Record payment in history
  booking.paymentHistory.push({
    amount,
    method: 'razorpay',
    transactionId: razorpay_payment_id,
    date: new Date(),
    status: 'success',
  });

  // 4. Update paidAmount and derive paymentStatus
  booking.paidAmount = (booking.paidAmount || 0) + amount;

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

  // Auto-create operation if newly confirmed or already confirmed
  if (booking.bookingStatus === 'confirmed') {
    const op = await autoCreateOperationFromBooking(booking._id);
    if (op && (paymentType === 'balance' || paymentType === 'full')) {
      const CustomerPayment = (await import('../models/CustomerPayment.js')).default;
      
      // Find the relevant upcoming payment and update it
      const query: any = { operation: op._id, status: { $in: ['upcoming', 'overdue', 'partial'] } };
      if (paymentType === 'balance') query.milestone = /Balance/i;
      
      const upcomingPayment = await CustomerPayment.findOne(query);
      if (upcomingPayment) {
        upcomingPayment.paidAmount = (upcomingPayment.paidAmount || 0) + amount;
        upcomingPayment.paidDate = new Date();
        upcomingPayment.paymentMode = 'razorpay';
        upcomingPayment.transactionId = razorpay_payment_id;
        
        if (upcomingPayment.paidAmount >= upcomingPayment.amount) {
          upcomingPayment.status = 'paid';
        } else {
          upcomingPayment.status = 'partial';
        }
        await upcomingPayment.save();
      }
    }
  }

  const justConfirmed = !wasConfirmed && booking.bookingStatus === 'confirmed';
  if (justConfirmed) {
    const pkg = booking.package as unknown as { _id: string; name: string };
    const customerName = `${usr.firstName || ''} ${usr.lastName || ''}`.trim() || 'Customer';
    const travellers = booking.travellers as { adults?: number; children?: number };
    const adults = travellers?.adults || 1;
    const children = travellers?.children || 0;
    
    // Update booked slots for group tours
    if (booking.departureId && pkg._id) {
      const Package = (await import('../models/Package.js')).default;
      await Package.updateOne(
        { _id: pkg._id, 'departures._id': booking.departureId },
        { $inc: { 'departures.$.bookedSlots': adults + children } }
      ).catch(console.error);
    }
    
    // Send to customer
    if (usr.email) {
      sendBookingConfirmation(usr.email, usr.firstName || 'Customer', {
        bookingId: booking.bookingId || String(booking._id),
        packageName: pkg?.name || 'Package',
        travelDate: booking.travelDate
          ? new Date(booking.travelDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
          : 'TBD',
        amount: booking.totalAmount,
        travellers: `${adults} Adult${adults > 1 ? 's' : ''}${children ? `, ${children} Child${children > 1 ? 'ren' : ''}` : ''}`,
      }).catch((err) => console.error('Failed to send booking confirmation:', err));
    }

    // Send to admin
    sendAdminNewBooking(
      customerName,
      pkg?.name || 'Package',
      booking.totalAmount,
      booking.travelDate
        ? new Date(booking.travelDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
        : 'TBD'
    ).catch((err) => console.error('Failed to send admin booking notification:', err));
  }

  res.status(200).json({
    status: 'success',
    data: {
      bookingId: String(booking._id),
      internalBookingId: booking.bookingId,
      paidAmount: booking.paidAmount,
      totalAmount: booking.totalAmount,
      paymentStatus: booking.paymentStatus,
      bookingStatus: booking.bookingStatus,
      razorpayPaymentId: razorpay_payment_id,
    },
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/payments/config/:packageId
// Returns the payment config for a given package (deposit % etc.)
// Used by the frontend to decide what to show before checkout
// ─────────────────────────────────────────────────────────────────────────────
export const getPaymentConfig = asyncHandler(async (req: Request, res: Response) => {
  const pkg = await Package.findById(req.params.packageId).select('paymentConfig price name');
  if (!pkg) throw new AppError('Package not found', 404);

  const pc = (pkg as unknown as {
    paymentConfig?: {
      mode: 'full' | 'partial';
      depositType: 'percent' | 'fixed';
      depositValue: number;
      depositLabel?: string;
      balanceDueDays?: number;
    };
  }).paymentConfig;

  const mode = pc?.mode || 'full';
  const depositType = pc?.depositType || 'percent';
  const depositValue = pc?.depositValue ?? 30;
  const price = pkg.price;

  const depositAmount =
    mode === 'partial'
      ? depositType === 'percent'
        ? Math.round((depositValue / 100) * price)
        : depositValue
      : price;

  res.status(200).json({
    status: 'success',
    data: {
      mode,
      depositType,
      depositValue,
      depositLabel: pc?.depositLabel || null,
      balanceDueDays: pc?.balanceDueDays || 30,
      depositAmount, // pre-calculated in INR
      keyId: env.RAZORPAY_KEY_ID,
    },
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/payments/create-link
// Body: { amount, description, customerName, customerEmail, customerPhone, bookingId, customerPaymentId }
// ─────────────────────────────────────────────────────────────────────────────
export const generatePaymentLink = asyncHandler(async (req: Request, res: Response) => {
  const { amount, description, customerName, customerEmail, customerPhone, bookingId, customerPaymentId } = req.body;

  if (!amount || amount <= 0) {
    throw new AppError('A valid amount is required', 400);
  }
  if (!bookingId && !customerPaymentId) {
    throw new AppError('Either bookingId or customerPaymentId is required', 400);
  }

  const razorpay = getRazorpay();

  const notes: Record<string, string> = {};
  if (bookingId) notes.bookingId = bookingId;
  if (customerPaymentId) notes.customerPaymentId = customerPaymentId;

  // Razorpay amounts are in paise
  const amountPaise = Math.round(Number(amount) * 100);

  try {
    const customerObj: any = {
      name: customerName || 'Customer',
    };
    const notifyObj: any = {
      sms: false,
      email: false,
    };

    if (customerEmail && customerEmail.includes('@')) {
      customerObj.email = customerEmail;
      notifyObj.email = true;
    }

    // Basic check for a valid-looking phone number (not just recurring digits)
    if (customerPhone && customerPhone.length >= 10 && !/^(\d)\1+$/.test(customerPhone.replace(/\D/g, ''))) {
      customerObj.contact = customerPhone;
      notifyObj.sms = true;
    }

    const paymentLink = await razorpay.paymentLink.create({
      amount: amountPaise,
      currency: 'INR',
      accept_partial: false,
      description: description || 'Payment for Letslivetours',
      customer: customerObj,
      notify: notifyObj,
      reminder_enable: true,
      notes: notes,
    });

    res.status(200).json({
      status: 'success',
      data: {
        id: paymentLink.id,
        short_url: paymentLink.short_url,
        status: paymentLink.status,
      },
    });
  } catch (error) {
    console.error('[Razorpay Error] paymentLink.create failed:', error);
    throw new AppError('Failed to generate Razorpay Payment Link', 500);
  }
});
