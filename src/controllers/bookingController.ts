import { Request, Response } from 'express';
import Booking from '../models/Booking.js';
import Package from '../models/Package.js';
import User from '../models/User.js';
import Operation from '../models/Operation.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { AppError } from '../middleware/errorHandler.js';
import { sendBookingConfirmation } from '../services/emailService.js';

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

  const booking = await Booking.create({
    ...req.body,
    user: userId,
    destination: pkg.destination,
    totalAmount,
  });

  // Send booking confirmation email (fire-and-forget)
  const user = await User.findById(userId);
  if (user) {
    sendBookingConfirmation(user.email, user.firstName, {
      bookingId: String(booking._id),
      packageName: pkg.name,
      travelDate: req.body.travelDate
        ? new Date(req.body.travelDate).toLocaleDateString('en-IN', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
          })
        : 'TBD',
      amount: totalAmount,
      travellers: `${adults} Adult${adults > 1 ? 's' : ''}${children ? `, ${children} Child${children > 1 ? 'ren' : ''}` : ''}`,
    }).catch((err) => console.error('Failed to send booking confirmation:', err));
  }

  res.status(201).json({
    status: 'success',
    data: booking,
  });
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

  // Check ownership or admin
  const isOwner = booking.user.toString() === req.user!._id.toString();
  const isAdmin = req.user!.role === 'admin';

  if (!isOwner && !isAdmin) {
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

        await Operation.create({
          booking: booking._id,
          package: pkg?._id || undefined,
          customer: {
            name: usr ? `${usr.firstName || ''} ${usr.lastName || ''}`.trim() : 'Customer',
            email: usr?.email || '',
            phone: usr?.phone || '',
            pax,
          },
          destination: dest?.name || 'TBD',
          travelDates: {
            start: populatedBooking.travelDate,
            end: populatedBooking.returnDate || populatedBooking.travelDate,
          },
          sellingPrice: populatedBooking.totalAmount || 0,
          status: 'planning',
        });
      }
    }
  }

  res.status(200).json({
    status: 'success',
    data: booking,
  });
});
