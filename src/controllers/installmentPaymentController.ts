import { Request, Response } from 'express';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { AppError } from '../middleware/errorHandler.js';
import crypto from 'crypto';
import CustomerPayment from '../models/CustomerPayment.js';
import Operation from '../models/Operation.js';
import Booking from '../models/Booking.js';
import { getRazorpay } from './paymentController.js';
import { env } from '../config/env.js';

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/operations/payments/:paymentId/details
// Public endpoint for the frontend to fetch payment details
// ─────────────────────────────────────────────────────────────────────────────
export const getInstallmentDetails = asyncHandler(async (req: Request, res: Response) => {
  const payment = await CustomerPayment.findById(req.params.paymentId).populate('operation');
  if (!payment) throw new AppError('Payment not found', 404);

  const op = payment.operation as unknown as {
    _id: string;
    packageName: string;
    customer: { name: string; email: string; phone: string };
  };

  const amountDue = payment.amount - payment.paidAmount;

  res.status(200).json({
    status: 'success',
    data: {
      paymentId: payment._id,
      milestone: payment.milestone,
      amountDue: amountDue > 0 ? amountDue : 0,
      totalAmount: payment.amount,
      status: payment.status,
      packageName: op.packageName,
      customerName: op.customer?.name,
      customerEmail: op.customer?.email,
      customerPhone: op.customer?.phone,
      keyId: env.RAZORPAY_KEY_ID,
    },
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/operations/payments/:paymentId/create-order
// ─────────────────────────────────────────────────────────────────────────────
export const createInstallmentOrder = asyncHandler(async (req: Request, res: Response) => {
  const payment = await CustomerPayment.findById(req.params.paymentId);
  if (!payment) throw new AppError('Payment not found', 404);

  const amountDue = payment.amount - payment.paidAmount;
  if (amountDue <= 0) {
    throw new AppError('This installment is already fully paid', 400);
  }

  const { customAmount } = req.body;
  let finalAmount = amountDue;

  if (customAmount) {
    const parsedAmount = Number(customAmount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      throw new AppError('Custom amount must be a valid positive number', 400);
    }
    if (parsedAmount > amountDue) {
      throw new AppError('Custom amount cannot exceed the total amount due', 400);
    }
    finalAmount = parsedAmount;
  }

  const razorpay = getRazorpay();
  const amountPaise = Math.round(finalAmount * 100);

  const options = {
    amount: amountPaise,
    currency: 'INR',
    receipt: `rcpt_${payment._id}`,
    notes: {
      customerPaymentId: String(payment._id),
      bookingId: String(payment.booking || ''),
      milestone: payment.milestone,
    },
  };

  const order = await razorpay.orders.create(options);

  res.status(200).json({
    status: 'success',
    data: {
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
    },
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/operations/payments/:paymentId/verify
// ─────────────────────────────────────────────────────────────────────────────
export const verifyInstallmentPayment = asyncHandler(async (req: Request, res: Response) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
  const paymentId = req.params.paymentId;

  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    throw new AppError('Incomplete payment details', 400);
  }

  // 1. Verify HMAC signature
  const body = razorpay_order_id + '|' + razorpay_payment_id;
  const expectedSignature = crypto
    .createHmac('sha256', env.RAZORPAY_KEY_SECRET)
    .update(body)
    .digest('hex');

  if (expectedSignature !== razorpay_signature) {
    throw new AppError('Payment verification failed — invalid signature', 400);
  }

  // 2. Find CustomerPayment
  const payment = await CustomerPayment.findById(paymentId);
  if (!payment) throw new AppError('Payment not found', 404);

  // Avoid duplicate verification
  if (payment.transactionId === razorpay_payment_id) {
    res.status(200).json({ status: 'success', message: 'Payment already verified' });
    return;
  }

  const razorpay = getRazorpay();
  const rzpPayment = await razorpay.payments.fetch(razorpay_payment_id);
  const amountINR = Math.round((rzpPayment.amount as number) / 100);

  // 3. Update CustomerPayment
  payment.paidAmount = (payment.paidAmount || 0) + amountINR;
  payment.paidDate = new Date();
  payment.paymentMode = 'razorpay';
  payment.transactionId = razorpay_payment_id;
  payment.financeStatus = 'approved'; // Auto approved since it's online
  
  if (payment.paidAmount >= payment.amount) {
    payment.status = 'paid';
  } else {
    payment.status = 'partial';
  }

  await payment.save();

  // 4. Update Booking if linked
  if (payment.booking) {
    const booking = await Booking.findById(payment.booking);
    if (booking) {
      // Check idempotency for booking
      const alreadyRecorded = booking.paymentHistory.some(p => p.transactionId === razorpay_payment_id);
      if (!alreadyRecorded) {
        booking.paymentHistory.push({
          amount: amountINR,
          method: 'razorpay',
          transactionId: razorpay_payment_id,
          date: new Date(),
          status: 'success',
        });
        booking.paidAmount = (booking.paidAmount || 0) + amountINR;
        if (booking.paidAmount >= booking.totalAmount) {
          booking.paymentStatus = 'paid';
          if (booking.bookingStatus === 'pending') booking.bookingStatus = 'confirmed';
        } else {
          booking.paymentStatus = 'partial';
          if (booking.bookingStatus === 'pending') booking.bookingStatus = 'confirmed';
        }
        await booking.save();
      }
    }
  }

  res.status(200).json({ status: 'success', data: payment });
});
