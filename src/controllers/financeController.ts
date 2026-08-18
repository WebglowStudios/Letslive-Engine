import { Request, Response } from 'express';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { AppError } from '../middleware/errorHandler.js';
import Booking from '../models/Booking.js';
import CustomerPayment from '../models/CustomerPayment.js';
import Operation from '../models/Operation.js';

// @desc    Get all pending finance approvals
// @route   GET /api/finance/approvals
export const getPendingApprovals = asyncHandler(async (req: Request, res: Response) => {
  const [bookingApprovals, opsApprovals] = await Promise.all([
    Booking.find({ paymentFinanceStatus: 'pending_approval' })
      .populate('user', 'firstName lastName email')
      .populate('financeDetails.requestedBy', 'firstName lastName')
      .sort({ updatedAt: -1 }),
    CustomerPayment.find({ financeStatus: 'pending_approval' })
      .populate('operation')
      .populate('requestedBy', 'firstName lastName')
      .sort({ updatedAt: -1 }),
  ]);

  res.status(200).json({
    status: 'success',
    data: {
      bookings: bookingApprovals,
      operations: opsApprovals,
    },
  });
});

// @desc    Approve or reject a payment
// @route   POST /api/finance/approvals/:type/:id
export const processApproval = asyncHandler(async (req: Request, res: Response) => {
  const { type, id } = req.params;
  const { action } = req.body; // 'approve' | 'reject'

  if (!['approve', 'reject'].includes(action)) {
    throw new AppError('Invalid action', 400);
  }

  if (type === 'booking') {
    const booking = await Booking.findById(id);
    if (!booking) throw new AppError('Booking not found', 404);
    if (booking.paymentFinanceStatus !== 'pending_approval') {
      throw new AppError('Booking payment is not pending approval', 400);
    }

    if (action === 'approve') {
      const approvedAmount = booking.financeDetails?.paidAmount || (booking.totalAmount - booking.paidAmount);

      booking.paymentFinanceStatus = 'approved';
      booking.paidAmount += approvedAmount;
      booking.paymentStatus = booking.paidAmount >= booking.totalAmount ? 'paid' : 'partial';
      
      // Update payment history
      booking.paymentHistory.push({
        amount: approvedAmount,
        method: booking.financeDetails?.mode || 'Unknown',
        transactionId: booking.financeDetails?.transactionId || '',
        date: new Date(),
        status: 'paid',
      });
      
      // Clear finance details payload after successful approval
      booking.financeDetails = undefined;
    } else {
      booking.paymentFinanceStatus = 'rejected';
      // Do not clear financeDetails so requestedBy can see why/what was rejected
    }

    await booking.save();
    return res.status(200).json({ status: 'success', data: booking });

  } else if (type === 'operation') {
    const payment = await CustomerPayment.findById(id);
    if (!payment) throw new AppError('Payment not found', 404);
    if (payment.financeStatus !== 'pending_approval') {
      throw new AppError('Operation payment is not pending approval', 400);
    }

    let difference = 0;

    if (action === 'approve') {
      payment.financeStatus = 'approved';
      const newlyPaid = payment.financeDetails?.paidAmount || payment.amount;
      difference = newlyPaid - (payment.paidAmount || 0);

      payment.paidAmount = newlyPaid;
      payment.paymentMode = payment.financeDetails?.mode || payment.paymentMode;
      payment.transactionId = payment.financeDetails?.transactionId || payment.transactionId;
      payment.paidDate = new Date();
      payment.status = payment.paidAmount >= payment.amount ? 'paid' : 'partial';
      
      // Clear financeDetails payload after successful approval
      payment.financeDetails = undefined;
    } else {
      payment.financeStatus = 'rejected';
    }

    await payment.save();

    // Trigger operation save to recalculate if needed
    const op = await Operation.findById(payment.operation);
    if (op) {
      if (action === 'approve' && difference !== 0) {
        const booking = await Booking.findById(op.booking);
        if (booking) {
          booking.paidAmount += difference;
          if (booking.paidAmount >= booking.totalAmount) {
            booking.paymentStatus = 'paid';
          } else if (booking.paidAmount > 0) {
            booking.paymentStatus = 'partial';
          } else {
            booking.paymentStatus = 'pending';
          }
          booking.paymentHistory.push({
            amount: difference,
            method: payment.paymentMode || 'Unknown',
            transactionId: payment.transactionId || '',
            date: new Date(),
            status: 'paid'
          });
          await booking.save();
        }
      }
      await op.save();
    }

    return res.status(200).json({ status: 'success', data: payment });
  }

  throw new AppError('Invalid approval type', 400);
});
