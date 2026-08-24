import mongoose from 'mongoose';
import Booking from '../models/Booking.js';
import Operation from '../models/Operation.js';
import CustomerPayment from '../models/CustomerPayment.js';
import Enquiry from '../models/Enquiry.js';
import { sendConversionCongrats } from '../services/emailService.js';

/**
 * Automates the creation of an Operation and initial CustomerPayments 
 * from a newly confirmed Booking. 
 */
export async function autoCreateOperationFromBooking(bookingId: string | mongoose.Types.ObjectId) {
  try {
    const existingOp = await Operation.findOne({ booking: bookingId });
    if (existingOp) {
      return existingOp;
    }

    const populatedBooking = await Booking.findById(bookingId)
      .populate('package', 'name price')
      .populate('destination', 'name')
      .populate('user', 'firstName lastName email phone');

    if (!populatedBooking) {
      return null;
    }

    const pkg = populatedBooking.package as unknown as { name?: string; price?: number; _id?: string; adultCount?: number; childCount?: number };
    const dest = populatedBooking.destination as unknown as { name?: string };
    const usr = populatedBooking.user as unknown as { firstName?: string; lastName?: string; email?: string; phone?: string };
    const travellers = populatedBooking.travellers as { adults?: number; children?: number; infants?: number };
    const travellersDetails = populatedBooking.travellersDetails as any[] || [];
    
    // Calculate pax using the max of (package default), (booking adult+child), or (actual details entered)
    const packageBasePax = (pkg?.adultCount || 0) + (pkg?.childCount || 0);
    const bookingTravellers = (travellers?.adults || 1) + (travellers?.children || 0);
    const enteredPax = travellersDetails.length;
    const pax = Math.max(packageBasePax, bookingTravellers, enteredPax, 1);
    
    const adults = Math.max(pkg?.adultCount || travellers?.adults || 1, travellersDetails.filter(t => t.type === 'adult').length);
    const children = Math.max(pkg?.childCount || travellers?.children || 0, travellersDetails.filter(t => t.type === 'child').length);

    const op = await Operation.create({
      booking: populatedBooking._id,
      operationId: `OP${String(populatedBooking._id).slice(-6).toUpperCase()}`,
      package: pkg?._id || undefined,
      enquiry: populatedBooking.enquiry || undefined,
      customer: {
        name: usr ? `${usr.firstName || ''} ${usr.lastName || ''}`.trim() : 'Customer',
        email: usr?.email || '',
        phone: usr?.phone || '',
        pax,
        adults,
        children,
      },
      destination: dest?.name || 'TBD',
      travelDates: {
        start: populatedBooking.travelDate,
        end: populatedBooking.returnDate || populatedBooking.travelDate,
      },
      sellingPrice: populatedBooking.totalAmount || 0,
      status: 'planning',
    });

    // Auto-generate Customer Payments (Installments)
    const total = populatedBooking.totalAmount || 0;
    const paid = populatedBooking.paidAmount || 0;

    if (paid >= total && total > 0) {
      // Full payment
      await CustomerPayment.create({
        operation: op._id,
        booking: populatedBooking._id,
        milestone: 'Full Payment',
        amount: total,
        paidAmount: paid,
        status: 'paid',
      });
    } else if (paid > 0 && paid < total) {
      // Partial payment (Deposit paid, balance upcoming)
      await CustomerPayment.create({
        operation: op._id,
        booking: populatedBooking._id,
        milestone: 'Advance Deposit',
        amount: paid,
        paidAmount: paid,
        status: 'paid',
      });
      await CustomerPayment.create({
        operation: op._id,
        booking: populatedBooking._id,
        milestone: 'Balance Payment',
        amount: total - paid,
        paidAmount: 0,
        status: 'upcoming',
      });
    } else if (total > 0) {
      // No payment made yet
      await CustomerPayment.create({
        operation: op._id,
        booking: populatedBooking._id,
        milestone: 'Full Payment Pending',
        amount: total,
        paidAmount: 0,
        status: 'upcoming',
      });
    }

    // Sync enquiry -> converted + conversionValue
    if (populatedBooking.enquiry) {
      const linkedEnquiry = await Enquiry.findById(populatedBooking.enquiry).populate('assignedTo', 'firstName lastName email');
      if (linkedEnquiry && linkedEnquiry.status !== 'converted') {
        linkedEnquiry.status = 'converted';
        linkedEnquiry.conversionValue = populatedBooking.totalAmount || 0;
        linkedEnquiry.bookingRef = populatedBooking._id as unknown as mongoose.Types.ObjectId;
        await linkedEnquiry.save();

        // Congrats email to the staff who owned this enquiry (fire-and-forget)
        const assignedStaff = linkedEnquiry.assignedTo as unknown as { firstName: string; lastName?: string; email: string } | null;
        if (assignedStaff?.email) {
          const customerName = `${linkedEnquiry.firstName} ${linkedEnquiry.lastName || ''}`.trim();
          sendConversionCongrats(
            assignedStaff.email,
            `${assignedStaff.firstName} ${assignedStaff.lastName || ''}`.trim(),
            customerName,
            populatedBooking.totalAmount || 0
          ).catch(console.error);
        }
      }
    }

    return op;
  } catch (error) {
    console.error('Failed to auto-create Operation:', error);
    return null;
  }
}
