import { Request, Response } from 'express';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { AppError } from '../middleware/errorHandler.js';
import Booking from '../models/Booking.js';
import CustomerPayment from '../models/CustomerPayment.js';
import Operation from '../models/Operation.js';
import Enquiry from '../models/Enquiry.js';
import User from '../models/User.js';
import Package from '../models/Package.js';
import { syncBookingPaymentToOperation } from '../utils/paymentSync.js';
import { autoCreateOperationFromBooking } from '../utils/operationBuilder.js';
import { sendBookingConfirmation } from '../services/emailService.js';

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
      const approvedAmount = (booking.financeDetails?.paidAmount !== undefined && booking.financeDetails?.paidAmount !== null && booking.financeDetails?.paidAmount > 0)
        ? booking.financeDetails.paidAmount
        : (booking.totalAmount - booking.paidAmount);

      booking.paymentFinanceStatus = 'approved';
      booking.bookingStatus = 'staff-confirmed';
      booking.paidAmount += approvedAmount;
      booking.paymentStatus = booking.paidAmount >= booking.totalAmount ? 'paid' : 'partial';
      
      const method = booking.financeDetails?.mode || 'Unknown';
      const transactionId = booking.financeDetails?.transactionId || '';
      
      // Update payment history
      booking.paymentHistory.push({
        amount: approvedAmount,
        method: method,
        transactionId: transactionId,
        date: new Date(),
        status: 'paid',
      });
      
      // Clear finance details payload after successful approval
      booking.financeDetails = undefined;

      // Auto-create Operation now that payment has been approved
      await autoCreateOperationFromBooking(String(booking._id));
      
      // Sync this manual payment down to the Operation's installments
      await syncBookingPaymentToOperation(booking._id, approvedAmount, method, transactionId);

      // Convert linked enquiry now that payment is approved
      if (booking.enquiry) {
        const staffName = req.user ? `${req.user.firstName} ${req.user.lastName}` : 'Finance';
        const refCode = booking.bookingId || String(booking._id).slice(-6).toUpperCase();
        await Enquiry.findByIdAndUpdate(booking.enquiry, {
          status: 'converted',
          conversionValue: booking.totalAmount,
          bookingRef: booking._id,
          $push: {
            notes: {
              text: `Finance approved offline payment of ₹${approvedAmount.toLocaleString('en-IN')}. Booking #${refCode} confirmed and lead marked as converted.`,
              date: new Date(),
              by: req.user!._id,
            },
            timeline: {
              type: 'converted',
              title: `Lead converted! Booking #${refCode}`,
              description: `Finance approved payment of ₹${approvedAmount.toLocaleString('en-IN')}. Booking confirmed.`,
              by: req.user!._id,
              byName: staffName,
              date: new Date(),
              meta: { bookingId: booking._id, totalAmount: booking.totalAmount, approvedAmount },
            },
          },
        });
      }

      // Send booking confirmation email to customer (fire-and-forget)
      const customer = await User.findById(booking.user).select('email firstName');
      const pkg = await Package.findById(booking.package).select('name');
      if (customer?.email && pkg?.name) {
        sendBookingConfirmation(
          customer.email,
          customer.firstName,
          {
            packageName: pkg.name,
            travelDate: new Date(booking.travelDate).toLocaleDateString('en-IN'),
            amount: booking.totalAmount,
            travellers: String((booking.travellers?.adults || 1) + (booking.travellers?.children || 0) + (booking.travellers?.infants || 0)),
            bookingId: String(booking.bookingId || booking._id),
          }
        ).catch(console.error);
      }
    } else {
      booking.paymentFinanceStatus = 'rejected';
      booking.bookingStatus = 'cancelled';

      const rejectedAmount = booking.financeDetails?.paidAmount || 0;
      const staffName = req.user ? `${req.user.firstName} ${req.user.lastName}` : 'Finance';
      const refCode = booking.bookingId || String(booking._id).slice(-6).toUpperCase();

      // If linked to an enquiry, revert lead status to in-progress (do NOT keep converted)
      if (booking.enquiry) {
        await Enquiry.findByIdAndUpdate(booking.enquiry, {
          status: 'in-progress',
          $unset: { conversionValue: 1 },
          $push: {
            notes: {
              text: `Finance disapproved/rejected offline payment of ₹${rejectedAmount.toLocaleString('en-IN')}. Booking #${refCode} cancelled. Lead returned to In-Progress.`,
              date: new Date(),
              by: req.user!._id,
            },
            timeline: {
              type: 'status_change',
              title: `Finance Disapproved Payment - Booking Cancelled`,
              description: `Finance rejected payment of ₹${rejectedAmount.toLocaleString('en-IN')}. Booking #${refCode} cancelled. Lead status returned to In-Progress.`,
              by: req.user!._id,
              byName: staffName,
              date: new Date(),
              meta: { bookingId: booking._id, rejectedAmount },
            },
          },
        });
      }

      // If an operation was already created for this booking, mark it cancelled
      await Operation.findOneAndUpdate(
        { $or: [{ bookings: booking._id }, { booking: booking._id }] },
        { status: 'cancelled' }
      );
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
        const booking = await Booking.findById(payment.booking);
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
