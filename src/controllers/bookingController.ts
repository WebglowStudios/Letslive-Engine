import { Request, Response } from 'express';
import mongoose from 'mongoose';
import Booking from '../models/Booking.js';
import Package from '../models/Package.js';
import User from '../models/User.js';
import Enquiry from '../models/Enquiry.js';
import Operation from '../models/Operation.js';
import CustomerPayment from '../models/CustomerPayment.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { AppError } from '../middleware/errorHandler.js';
import { sendBookingConfirmation, sendAdminNewBooking, sendConversionCongrats } from '../services/emailService.js';
import { logActivity } from '../utils/logActivity.js';
import ActivityLog from '../models/ActivityLog.js';

// @desc    Create a booking
// @route   POST /api/bookings
export const createBooking = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!._id;
  const { package: packageId, travellers } = req.body;

  const pkg = await Package.findById(packageId);
  if (!pkg) {
    throw new AppError('Package not found', 404);
  }

  const adults = travellers?.adults || 1;
  const children = travellers?.children || 0;

  const totalAmount = pkg.price * adults + pkg.price * 0.7 * children;

  // Get user details for enquiry creation
  const user = await User.findById(userId);
  const customerName = user ? `${user.firstName} ${user.lastName}`.trim() : 'Customer';
  const customerEmail = user?.email || req.body.contactEmail || '';
  const customerPhone = user?.phone || req.body.contactPhone || '';

  // Auto-create enquiry for this booking (so every booking has an enquiry trail)
  let enquiryId: string | undefined;

  // Check if package already has a linked enquiry (custom itinerary case)
  if (pkg.enquiryId) {
    // Update existing enquiry status to "converted"
    await Enquiry.findByIdAndUpdate(pkg.enquiryId, { status: 'converted' });
    enquiryId = String(pkg.enquiryId);
  } else {
    // Create a new enquiry for this booking
    const newEnquiry = await Enquiry.create({
      type: 'booking',
      firstName: user?.firstName || req.body.primaryTraveller?.firstName || 'Customer',
      lastName: user?.lastName || req.body.primaryTraveller?.lastName || '',
      email: customerEmail,
      phone: customerPhone,
      packageName: pkg.name,
      package: pkg._id,
      destination: pkg.destination ? String(pkg.destination) : undefined,
      travelDate: req.body.travelDate,
      message: `Booked via website. ${req.body.specialRequests || ''}`.trim(),
      status: 'converted',
      priority: 'high',
      source: 'website',
    });
    enquiryId = String(newEnquiry._id);
  }

  const booking = await Booking.create({
    ...req.body,
    user: userId,
    destination: pkg.destination,
    enquiry: enquiryId,
    totalAmount,
  });

  // Emails are no longer sent here! They have been moved to payment verification
  // and webhook processing to ensure they only send when payment succeeds.

  res.status(201).json({
    status: 'success',
    data: booking,
  });

  // Log user booking created (fire-and-forget)
  const booker = await User.findById(userId).select('firstName lastName email role').lean();
  if (booker) {
    ActivityLog.create({
      user: userId,
      userName: `${booker.firstName} ${booker.lastName}`,
      userRole: booker.role,
      action: 'create',
      entity: 'booking',
      entityId: String(booking._id),
      entityName: pkg.name,
      description: `Customer booked "${pkg.name}" — ${booking.bookingId || String(booking._id).slice(-6).toUpperCase()}`,
      meta: { packageId: String(pkg._id), totalAmount: booking.totalAmount, travelDate: booking.travelDate },
    }).catch(console.error);
  }
});

// @desc    Get current user's bookings
// @route   GET /api/bookings
export const getUserBookings = asyncHandler(async (req: Request, res: Response) => {
  const bookings = await Booking.find({ user: req.user!._id })
    .populate('package', 'name slug images duration')
    .populate('destination', 'name slug')
    .sort({ createdAt: -1 });

  res.status(200).json({
    status: 'success',
    results: bookings.length,
    data: bookings,
  });
});

// @desc    Get booking by ID
// @route   GET /api/bookings/:id
export const getBookingById = asyncHandler(async (req: Request, res: Response) => {
  const booking = await Booking.findById(req.params.id)
    .populate('package')
    .populate('destination');

  if (!booking) {
    throw new AppError('Booking not found', 404);
  }

  // Check ownership or staff+
  const isOwner = booking.user.toString() === req.user!._id.toString();
  const isStaffOrAbove = ["admin", "manager", "staff"].includes(req.user!.role);

  if (!isOwner && !isStaffOrAbove) {
    throw new AppError('Not authorized to view this booking', 403);
  }

  res.status(200).json({
    status: 'success',
    data: booking,
  });
});

// @desc    Cancel a booking
// @route   PUT /api/bookings/:id/cancel
export const cancelBooking = asyncHandler(async (req: Request, res: Response) => {
  const booking = await Booking.findById(req.params.id);

  if (!booking) {
    throw new AppError('Booking not found', 404);
  }

  // Check ownership
  if (booking.user.toString() !== req.user!._id.toString()) {
    throw new AppError('Not authorized to cancel this booking', 403);
  }

  if (!['pending', 'confirmed'].includes(booking.bookingStatus)) {
    throw new AppError('This booking cannot be cancelled', 400);
  }

  booking.bookingStatus = 'cancelled';
  booking.cancellationReason = req.body.cancellationReason;
  booking.cancelledAt = new Date();
  await booking.save();

  // Log user booking cancellation (fire-and-forget)
  const cancelUser = req.user!;
  ActivityLog.create({
    user: cancelUser._id,
    userName: `${cancelUser.firstName} ${cancelUser.lastName}`,
    userRole: cancelUser.role,
    action: 'status_change',
    entity: 'booking',
    entityId: String(booking._id),
    entityName: String(booking._id),
    description: `Customer cancelled booking ${String(booking._id).slice(-6).toUpperCase()}${req.body.cancellationReason ? ` — reason: ${req.body.cancellationReason}` : ''}`,
    meta: { reason: req.body.cancellationReason },
  }).catch(console.error);

  res.status(200).json({
    status: 'success',
    data: booking,
  });
});

// @desc    Get all bookings (admin)
// @route   GET /api/bookings/all
export const getAllBookings = asyncHandler(async (req: Request, res: Response) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 10;
  const skip = (page - 1) * limit;

  const filter: Record<string, unknown> = {};
  if (req.query.bookingStatus) filter.bookingStatus = req.query.bookingStatus;
  if (req.query.paymentStatus) filter.paymentStatus = req.query.paymentStatus;

  const [bookings, total] = await Promise.all([
    Booking.find(filter)
      .populate('user', 'firstName lastName email')
      .populate('package', 'name')
      .populate('destination', 'name')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    Booking.countDocuments(filter),
  ]);

  res.status(200).json({
    status: 'success',
    results: bookings.length,
    total,
    page,
    pages: Math.ceil(total / limit),
    data: bookings,
  });
});

// @desc    Update booking status (admin)
// @route   PUT /api/bookings/:id/status
export const updateBookingStatus = asyncHandler(async (req: Request, res: Response) => {
  const { bookingStatus, paymentStatus } = req.body;

  const booking = await Booking.findById(req.params.id);
  if (!booking) {
    throw new AppError('Booking not found', 404);
  }

  if (bookingStatus) {
    booking.bookingStatus = bookingStatus;
    // Auto-sync payment status when booking status changes
    if (bookingStatus === 'confirmed' && booking.paymentStatus === 'pending') {
      booking.paymentStatus = 'paid';
    }
    if (bookingStatus === 'cancelled' && booking.paymentStatus === 'paid') {
      booking.paymentStatus = 'refunded';
    }
  }
  if (paymentStatus) booking.paymentStatus = paymentStatus;
  await booking.save();

  await logActivity({
    req,
    action: 'status_change',
    entity: 'booking',
    entityId: String(booking._id),
    entityName: String(booking._id),
    description: `Updated booking #${String(booking._id).slice(-6).toUpperCase()} — status: ${bookingStatus || booking.bookingStatus}, payment: ${paymentStatus || booking.paymentStatus}`,
    meta: { bookingStatus, paymentStatus },
  });

  // Auto-create Operation when booking is confirmed for the first time
  if (bookingStatus === 'confirmed') {
    const existingOp = await Operation.findOne({ booking: booking._id });
    if (!existingOp) {
      // Populate needed fields
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

        // ── Auto-generate Customer Payments (Installments) ──
        const total = populatedBooking.totalAmount || 0;
        const paid = populatedBooking.paidAmount || 0;

        if (paid >= total && total > 0) {
          // Full payment
          await CustomerPayment.create({
            operation: op._id,
            booking: booking._id,
            milestone: 'Full Payment',
            amount: total,
            paidAmount: paid,
            status: 'paid',
          });
        } else if (paid > 0 && paid < total) {
          // Partial payment (Deposit paid, balance upcoming)
          await CustomerPayment.create({
            operation: op._id,
            booking: booking._id,
            milestone: 'Advance Deposit',
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
          // No payment made yet
          await CustomerPayment.create({
            operation: op._id,
            booking: booking._id,
            milestone: 'Full Payment Pending',
            amount: total,
            paidAmount: 0,
            status: 'upcoming',
          });
        }

        // ── Task 1: Sync enquiry → converted + conversionValue ──────────────
        if (populatedBooking.enquiry) {
          const linkedEnquiry = await Enquiry.findById(populatedBooking.enquiry).populate('assignedTo', 'firstName lastName email');
          if (linkedEnquiry && linkedEnquiry.status !== 'converted') {
            const prevStatus = linkedEnquiry.status;
            linkedEnquiry.status = 'converted';
            linkedEnquiry.conversionValue = populatedBooking.totalAmount || 0;
            linkedEnquiry.bookingRef = booking._id as unknown as mongoose.Types.ObjectId;
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
        // ───────────────────────────────────────────────────────────────────
      }
    }
  }

  res.status(200).json({
    status: 'success',
    data: booking,
  });
});
