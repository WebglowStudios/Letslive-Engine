import mongoose from 'mongoose';
import Operation from '../models/Operation.js';
import CustomerPayment from '../models/CustomerPayment.js';

/**
 * Distributes a payment made at the Booking level to the Operation's scheduled CustomerPayments.
 */
export async function syncBookingPaymentToOperation(
  bookingId: string | mongoose.Types.ObjectId,
  amount: number,
  method: string,
  transactionId: string
) {
  try {
    const op = await Operation.findOne({ booking: bookingId });
    if (!op) return; // No operation exists yet, auto-create will handle initial payments if needed

    // Find all unpaid installments
    const unpaidPayments = await CustomerPayment.find({
      operation: op._id,
      status: { $ne: 'paid' },
    }).sort({ dueDate: 1, _id: 1 });

    let remaining = amount;

    for (const payment of unpaidPayments) {
      if (remaining <= 0) break;

      const due = payment.amount - (payment.paidAmount || 0);
      if (due <= 0) continue;

      const toPay = Math.min(due, remaining);
      payment.paidAmount = (payment.paidAmount || 0) + toPay;
      payment.paymentMode = method || payment.paymentMode;
      payment.transactionId = transactionId || payment.transactionId;
      payment.paidDate = new Date();
      payment.status = payment.paidAmount >= payment.amount ? 'paid' : 'partial';
      
      await payment.save();
      remaining -= toPay;
    }

    // If there is still money left over, it means they overpaid or no upcoming installments covered it.
    // We create a new "paid" installment for the remainder so it shows up in Operations.
    if (remaining > 0) {
      await CustomerPayment.create({
        operation: op._id,
        booking: bookingId,
        milestone: 'Direct Booking Payment',
        amount: remaining,
        paidAmount: remaining,
        status: 'paid',
        paymentMode: method,
        transactionId: transactionId,
        paidDate: new Date(),
      });
    }
  } catch (error) {
    console.error('[SYNC] Failed to sync booking payment to operation:', error);
  }
}
