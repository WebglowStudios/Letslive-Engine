import { Request, Response } from 'express';
import mongoose from 'mongoose';
import Booking from '../models/Booking.js';
import Package from '../models/Package.js';
import User from '../models/User.js';
import Enquiry from '../models/Enquiry.js';
import Operation from '../models/Operation.js';
import Coupon from '../models/Coupon.js';
import CustomerPayment from '../models/CustomerPayment.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { AppError } from '../middleware/errorHandler.js';
import { sendBookingConfirmation, sendAdminNewBooking, sendConversionCongrats, sendBookingCancelledUserEmail, sendBookingCancelledStaffEmail } from '../services/emailService.js';
import { logActivity } from '../utils/logActivity.js';
import ActivityLog from '../models/ActivityLog.js';
import { autoCreateOperationFromBooking } from '../utils/operationBuilder.js';
import crypto from 'crypto';
import { generateAccessToken, generateRefreshToken, setTokenCookies } from '../utils/generateToken.js';

const sanitizeTravellersDetails = (details?: any[]): any[] => {
  if (!details || !Array.isArray(details)) return [];
  return details.map((t: any) => {
    let age = (t.age !== '' && t.age !== undefined && t.age !== null) ? Number(t.age) : undefined;
    let dob = t.dob ? new Date(t.dob) : undefined;
    if (age === undefined && dob && !isNaN(dob.getTime())) {
      const today = new Date();
      let calculatedAge = today.getFullYear() - dob.getFullYear();
      const m = today.getMonth() - dob.getMonth();
      if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) {
        calculatedAge--;
      }
      if (calculatedAge >= 0) age = calculatedAge;
    }
    return {
      ...t,
      age,
      dob,
    };
  });
};

// @desc    Create a booking
// @route   POST /api/bookings
export const createBooking = asyncHandler(async (req: Request, res: Response) => {
  let userId = req.user?._id;

  if (!userId) {
    const email = req.body.primaryTraveller?.email || req.body.contactEmail;
    if (!email) throw new AppError('Email is required for guest checkout', 400);

    let user = await User.findOne({ email });
    if (!user) {
      user = await User.create({
        email,
        firstName: req.body.primaryTraveller?.firstName || req.body.contactEmail?.split('@')[0] || 'Guest',
        lastName: req.body.primaryTraveller?.lastName || '',
        phone: req.body.primaryTraveller?.phone || req.body.contactPhone,
        password: crypto.randomBytes(8).toString('hex'),
      });
    }

    userId = user._id;

    // Implicitly log the user in so subsequent /create-order calls work
    const accessToken = generateAccessToken(String(userId));
    const refreshToken = generateRefreshToken(String(userId));
    setTokenCookies(res, accessToken, refreshToken);
  }

  const { package: packageId, travellers } = req.body;

  if (req.body.travellersDetails) {
    req.body.travellersDetails = sanitizeTravellersDetails(req.body.travellersDetails);
  }

  const pkg = await Package.findById(packageId);
  if (!pkg) {
    throw new AppError('Package not found', 404);
  }

  const adults = travellers?.adults || 1;
  const children = travellers?.children || 0;
  const infants = travellers?.infants || 0;
  const totalPax = adults + children + infants;

  if (pkg.isInternational) {
    if (!req.body.primaryTraveller?.panCard) {
      throw new AppError('PAN Card details are required for international bookings', 400);
    }
    if (!req.body.travellersDetails || req.body.travellersDetails.length !== totalPax) {
      throw new AppError(`Passport details are required for all ${totalPax} travellers`, 400);
    }
    for (const t of req.body.travellersDetails) {
      if (!t.passportNumber || !t.passportExpiry || !t.issuingCountry) {
        throw new AppError(`Passport number, expiry date, and issuing country are required for traveller: ${t.name || 'Unknown'}`, 400);
      }
    }
  }

  let basePrice = pkg.price;
  if (req.body.departureId && pkg.isGroupTour && pkg.departures) {
    const dep = pkg.departures.find((d: any) => String(d._id) === String(req.body.departureId));
    if (dep && dep.price > 0) {
      basePrice = dep.price;
    }
  }

  let totalAmount = basePrice * adults + basePrice * children;
  if (pkg.priceUnit === 'group') {
    const includedPax = (pkg.adultCount || 0) + (pkg.childCount || 0) || 1;
    const totalPax = adults + children;
    if (totalPax > includedPax && pkg.extraPersonPrice) {
      totalAmount = basePrice + ((totalPax - includedPax) * pkg.extraPersonPrice);
    } else {
      totalAmount = basePrice;
    }
  }
  
  let discountAmount = 0;
  let appliedCouponCode = undefined;

  if (req.body.couponCode) {
    const coupon = await Coupon.findOne({ code: req.body.couponCode.toUpperCase(), isActive: true });
    if (coupon) {
      const now = new Date();
      if (now >= coupon.validFrom && now <= coupon.validUntil) {
        let isValid = true;
        if (coupon.validPackages && coupon.validPackages.length > 0) {
          if (!coupon.validPackages.some(id => id.toString() === String(pkg._id))) isValid = false;
        }
        if (coupon.minOrderValue && totalAmount < coupon.minOrderValue) isValid = false;
        if (coupon.usageLimit && coupon.usedCount >= coupon.usageLimit) isValid = false;
        
        if (isValid) {
          if (coupon.type === 'percentage') {
            discountAmount = (totalAmount * coupon.value) / 100;
            if (coupon.maxDiscount && discountAmount > coupon.maxDiscount) discountAmount = coupon.maxDiscount;
          } else {
            discountAmount = coupon.value;
          }
          if (discountAmount > totalAmount) discountAmount = totalAmount;
          
          totalAmount -= discountAmount;
          appliedCouponCode = coupon.code;
          
          coupon.usedCount += 1;
          await coupon.save();
        }
      }
    }
  }

  // Get user details for enquiry creation
  const user = await User.findById(userId);
  const customerName = user ? `${user.firstName} ${user.lastName}`.trim() : 'Customer';
  const customerEmail = user?.email || req.body.contactEmail || '';
  const customerPhone = user?.phone || req.body.contactPhone || '';

  // Auto-create enquiry for this booking (so every booking has an enquiry trail)
  let enquiryId = req.body.enquiryId;

  if (!enquiryId && pkg.enquiryId) {
    enquiryId = String(pkg.enquiryId);
  }

  if (!enquiryId) {
    // Create a new enquiry for this booking — always link to the booking user
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
      user: userId,  // ← link to the customer so it appears in their dashboard
    });
    enquiryId = String(newEnquiry._id);
  }

  const booking = await Booking.create({
    ...req.body,
    user: userId,
    destination: pkg.destination,
    enquiry: enquiryId,
    totalAmount,
    couponCode: appliedCouponCode,
    discountAmount,
  });

  // Automatically update the enquiry: mark converted, link to user account (so it
  // appears in their dashboard), and push a booking-confirmed note & timeline event for staff.
  if (enquiryId) {
    const refCode = booking.bookingId || String(booking._id).slice(-6).toUpperCase();
    await Enquiry.findByIdAndUpdate(enquiryId, {
      status: 'converted',
      user: userId,   // ← backfill the user link in case enquiry was submitted anonymously
      bookingRef: booking._id,
      conversionValue: totalAmount,
      $push: {
        notes: {
          text: `Customer successfully booked this package via the website! Booking Ref: ${refCode}`,
          date: new Date(),
        },
        timeline: {
          type: 'converted',
          title: `Lead converted! Booking #${refCode}`,
          description: `Customer completed booking online. Total amount: ₹${totalAmount.toLocaleString('en-IN')}`,
          date: new Date(),
          meta: { bookingId: booking._id, totalAmount, bookingRef: refCode },
        },
      },
    });
  }

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

// @desc    Create a manual / offline booking (admin/staff only)
// @route   POST /api/bookings/manual
export const createManualBooking = asyncHandler(async (req: Request, res: Response) => {
  const staffId = req.user!._id;
  const {
    enquiryId,
    packageId,
    userId: customerId,
    travelDate,
    returnDate,
    travellers,
    travellersDetails,
    primaryTraveller,
    totalAmount,
    offlinePayment,
    specialRequests,
  } = req.body;

  if (!customerId) throw new AppError('Customer user ID is required. Please search and select an existing customer account.', 400);
  if (!packageId) throw new AppError('Package ID is required.', 400);
  if (!travelDate) throw new AppError('Travel date is required.', 400);
  if (!totalAmount || totalAmount <= 0) throw new AppError('Total amount must be greater than 0.', 400);

  const pkg = await Package.findById(packageId);
  if (!pkg) throw new AppError('Package not found', 404);

  const customer = await User.findById(customerId);
  if (!customer) throw new AppError('Customer account not found. Please select a valid customer.', 404);

  const sanitizedTravellers = sanitizeTravellersDetails(travellersDetails);

  // International package validation
  if (pkg.isInternational) {
    if (!primaryTraveller?.panCard) throw new AppError('PAN Card is required for international bookings.', 400);
    const adults = travellers?.adults || 1;
    const children = travellers?.children || 0;
    const infants = travellers?.infants || 0;
    const totalPax = adults + children + infants;
    if (!travellersDetails || travellersDetails.length !== totalPax) {
      throw new AppError(`Passport details are required for all ${totalPax} travellers.`, 400);
    }
    for (const t of travellersDetails) {
      if (!t.passportNumber || !t.passportExpiry || !t.issuingCountry) {
        throw new AppError(`Passport number, expiry, and issuing country required for: ${t.name || 'Unknown'}`, 400);
      }
    }
  }

  const paid = offlinePayment?.paidAmount || 0;
  const paymentStatus: 'pending' | 'partial' | 'paid' =
    paid <= 0 ? 'pending' : paid >= totalAmount ? 'paid' : 'partial';

  const paymentHistory = paid > 0 ? [{
    amount: paid,
    method: offlinePayment?.mode || 'cash',
    transactionId: offlinePayment?.transactionId || '',
    date: new Date(),
    status: 'completed',
  }] : [];

  const booking = await Booking.create({
    user: customerId,
    package: packageId,
    destination: pkg.destination,
    enquiry: enquiryId || undefined,
    travelDate,
    returnDate,
    travellers: travellers || { adults: 1, children: 0, infants: 0 },
    travellersDetails: sanitizedTravellers || [],
    primaryTraveller: primaryTraveller || {},
    totalAmount,
    paidAmount: paid,
    paymentStatus,
    bookingStatus: 'staff-confirmed',
    bookingSource: 'admin_manual',
    specialRequests,
    contactEmail: customer.email,
    contactPhone: customer.phone || '',
    paymentHistory,
    financeDetails: paid > 0 ? {
      paidAmount: paid,
      mode: offlinePayment?.mode || 'cash',
      transactionId: offlinePayment?.transactionId || '-',
      remarks: offlinePayment?.remarks || 'Offline payment recorded by staff',
      requestedBy: staffId,
    } : undefined,
  });

  // Auto-create Operation
  await autoCreateOperationFromBooking(String(booking._id));

  // Update linked enquiry if provided
  if (enquiryId) {
    const staff = await User.findById(staffId).select('firstName lastName').lean();
    const staffName = staff ? `${staff.firstName} ${staff.lastName}` : 'Staff';
    const refCode = booking.bookingId || String(booking._id).slice(-6).toUpperCase();
    await Enquiry.findByIdAndUpdate(enquiryId, {
      status: 'converted',
      user: customerId,
      bookingRef: booking._id,
      conversionValue: totalAmount,
      $push: {
        notes: {
          text: `Manual/offline booking created by ${staffName}. Payment: ₹${paid.toLocaleString('en-IN')} via ${offlinePayment?.mode || 'cash'}. Booking Ref: ${refCode}`,
          date: new Date(),
          by: staffId,
        },
        timeline: {
          type: 'converted',
          title: `Lead converted! Booking #${refCode}`,
          description: `Manual booking created by ${staffName}. Paid ₹${paid.toLocaleString('en-IN')} via ${offlinePayment?.mode || 'cash'} (Total: ₹${totalAmount.toLocaleString('en-IN')})`,
          by: staffId,
          byName: staffName,
          date: new Date(),
          meta: { bookingId: booking._id, totalAmount, paid, mode: offlinePayment?.mode },
        },
      },
    });
  }

  // Send booking confirmation email (fire-and-forget)
  sendBookingConfirmation(
    customer.email,
    customer.firstName,
    {
      packageName: pkg.name,
      travelDate: new Date(booking.travelDate).toLocaleDateString('en-IN'),
      amount: totalAmount,
      travellers: String((booking.travellers?.adults || 1) + (booking.travellers?.children || 0) + (booking.travellers?.infants || 0)),
      bookingId: String(booking.bookingId || booking._id)
    }
  ).catch(console.error);

  // Activity log
  ActivityLog.create({
    user: staffId,
    userName: `${req.user!.firstName} ${req.user!.lastName}`,
    userRole: req.user!.role,
    action: 'create',
    entity: 'booking',
    entityId: String(booking._id),
    entityName: pkg.name,
    description: `Manual offline booking created for ${customer.firstName} ${customer.lastName} — ${booking.bookingId || String(booking._id).slice(-6).toUpperCase()} | ₹${paid} via ${offlinePayment?.mode || 'cash'}`,
    meta: { packageId: String(pkg._id), totalAmount, paidAmount: paid, mode: offlinePayment?.mode },
  }).catch(console.error);

  res.status(201).json({
    status: 'success',
    data: booking,
  });
});

export const getUserBookings = asyncHandler(async (req: Request, res: Response) => {
  const bookings = await Booking.find({ user: req.user!._id })
    .populate('package', 'name slug images duration isInternational visaIncluded flightsIncluded')
    .populate('destination', 'name slug')
    .sort({ createdAt: -1 })
    .lean();

  const Operation = (await import('../models/Operation.js')).default;
  const bookingIds = bookings.map(b => b._id);
  const operations = await Operation.find({
    $or: [
      { bookings: { $in: bookingIds } },
      { booking: { $in: bookingIds } },
    ]
  }).select('status voucherGenerated bookings booking').lean();

  const enhanced = bookings.map((b: any) => {
    const op = operations.find(o => 
      (o.bookings && o.bookings.some(bid => String(bid) === String(b._id))) ||
      (o.booking && String(o.booking) === String(b._id))
    );
    const opStatus = op?.status;
    const isVendorConfirmed = opStatus === 'vendor-confirmed' || 
      b.bookingStatus === 'vendor-confirmed' || 
      ['in-progress', 'completed'].includes(opStatus || '') || 
      Boolean(op?.voucherGenerated);
    return {
      ...b,
      operationStatus: opStatus || null,
      isVendorConfirmed,
    };
  });

  res.status(200).json({
    status: 'success',
    results: enhanced.length,
    data: enhanced,
  });
});

// @desc    Get booking by ID
// @route   GET /api/bookings/:id
export const getBookingById = asyncHandler(async (req: Request, res: Response) => {
  const booking = await Booking.findById(req.params.id)
    .populate('user', 'firstName lastName email phone')
    .populate('package')
    .populate('destination')
    .populate({
      path: 'enquiry',
      populate: {
        path: 'assignedTo',
        select: 'firstName lastName avatar description phone'
      }
    });

  if (!booking) {
    throw new AppError('Booking not found', 404);
  }

  // Check ownership or staff+
  const isOwner = booking.user && booking.user._id ? booking.user._id.toString() === req.user!._id.toString() : false;
  const isStaffOrAbove = ["admin", "manager", "staff", "ops-staff", "ops-manager", "sales-staff", "sales-manager"].includes(req.user!.role);

  if (!isOwner && !isStaffOrAbove) {
    throw new AppError('Not authorized to view this booking', 403);
  }

  // Synchronize paidAmount with actual CustomerPayment cards if they exist
  const CustomerPayment = (await import('../models/CustomerPayment.js')).default;
  const Operation = (await import('../models/Operation.js')).default;
  
  let payments: any[] = [];
  const operation = await Operation.findOne({
    $or: [{ bookings: booking._id }, { booking: booking._id }]
  });
  if (operation) {
    payments = await CustomerPayment.find({ operation: operation._id });
    // Auto-repair any cards missing the booking reference
    const brokenCards = payments.filter(p => !p.booking);
    for (const p of brokenCards) {
      p.booking = booking._id;
      await p.save();
    }
  } else {
    payments = await CustomerPayment.find({ booking: booking._id });
  }
  
  if (payments.length > 0) {
    const totalPaidFromCards = payments.reduce((sum, p) => sum + (p.paidAmount || 0), 0);
    if (booking.paidAmount !== totalPaidFromCards) {
      booking.paidAmount = totalPaidFromCards;
      if (booking.paidAmount >= booking.totalAmount) {
        booking.paymentStatus = 'paid';
      } else if (booking.paidAmount > 0) {
        booking.paymentStatus = 'partial';
      } else {
        booking.paymentStatus = 'pending';
      }
      await Booking.updateOne(
        { _id: booking._id }, 
        { $set: { paidAmount: booking.paidAmount, paymentStatus: booking.paymentStatus } }
      );
    }
  }

  const isVendorConfirmed = operation?.status === 'vendor-confirmed' ||
    booking.bookingStatus === 'vendor-confirmed' ||
    ['in-progress', 'completed'].includes(operation?.status || '') ||
    Boolean(operation?.voucherGenerated);

  const bookingData = {
    ...booking.toObject(),
    operationStatus: operation?.status || null,
    isVendorConfirmed,
    voucherAvailable: isVendorConfirmed,
  };

  res.status(200).json({
    status: 'success',
    data: bookingData,
  });
});

// @desc    Get complete voucher data for a booking
// @route   GET /api/bookings/:id/voucher-data
export const getBookingVoucherData = asyncHandler(async (req: Request, res: Response) => {
  const booking = await Booking.findById(req.params.id)
    .populate('user', 'firstName lastName email phone')
    .populate('package');

  if (!booking) {
    throw new AppError('Booking not found', 404);
  }

  // Check ownership or staff+
  const isOwner = booking.user && (booking.user as any)._id
    ? (booking.user as any)._id.toString() === req.user!._id.toString()
    : false;
  const isStaffOrAbove = ['admin', 'manager', 'staff', 'ops-staff', 'ops-manager', 'sales-staff', 'sales-manager'].includes(req.user!.role);

  if (!isOwner && !isStaffOrAbove) {
    throw new AppError('Not authorized to access this voucher', 403);
  }

  const Operation = (await import('../models/Operation.js')).default;
  const OperationTransport = (await import('../models/OperationTransport.js')).default;
  const OperationAccommodation = (await import('../models/OperationAccommodation.js')).default;
  const OperationActivity = (await import('../models/OperationActivity.js')).default;

  const operation = await Operation.findOne({
    $or: [{ bookings: booking._id }, { booking: booking._id }]
  });

  if (!operation) {
    throw new AppError('Post-sales operation not found for this booking', 404);
  }

  const isConfirmed = operation.status === 'vendor-confirmed' ||
    booking.bookingStatus === 'vendor-confirmed' ||
    ['in-progress', 'completed'].includes(operation.status) ||
    Boolean(operation.voucherGenerated);

  if (!isConfirmed && !isStaffOrAbove) {
    throw new AppError('Voucher is not yet available. It will be unlocked once vendors are confirmed by operations.', 400);
  }

  const [transports, accommodations, activities] = await Promise.all([
    OperationTransport.find({ operation: operation._id }).lean(),
    OperationAccommodation.find({ operation: operation._id }).lean(),
    OperationActivity.find({ operation: operation._id }).lean(),
  ]);

  const pkg = booking.package as any;

  let itinerary = pkg?.itinerary || [];
  let transferSummary = pkg?.transferSummary || '';
  const hasPolicies = Boolean(
    (pkg?.paymentPolicy?.length > 0) ||
    (pkg?.cancellationPolicy?.length > 0) ||
    (pkg?.flightCancellationPolicy?.length > 0)
  );

  // Fallback to activities if package has no itinerary
  if ((!itinerary || itinerary.length === 0) && activities.length > 0) {
    itinerary = activities.map((a: any, i: number) => {
      const dayMatch = (a.tripDay || '').match(/\d+/);
      const dayNum = dayMatch ? parseInt(dayMatch[0], 10) : (i + 1);
      return {
        day: dayNum,
        title: a.title || `Day ${dayNum}`,
        description: a.description || '',
        meals: [],
      };
    }).sort((a: any, b: any) => a.day - b.day);
  }

  let pdfFlights: any[] = transports
    .filter((t: any) => t.type === 'flight')
    .flatMap((t: any) => (t.legs || []).map((leg: any) => ({
      airline: t.vendorName || t.title,
      date: leg.date,
      from: leg.from,
      to: leg.to,
      departure: leg.departureTime,
      arrival: leg.arrivalTime,
    })));

  if (pdfFlights.length === 0) {
    const pkgFlights = pkg?.flights || [];
    pdfFlights = pkgFlights.filter((f: any) => f && (f.airline || f.from || f.to)).map((f: any) => ({
      airline: f.airline || 'Flight',
      date: f.day ? `Day ${f.day}` : undefined,
      from: f.from,
      to: f.to,
      departure: f.departure,
      arrival: f.arrival,
    }));
  }

  const pdfTransports = transports.filter((t: any) => t.type !== 'flight');

  const customerName = booking.primaryTraveller?.firstName
    ? `${booking.primaryTraveller.firstName} ${booking.primaryTraveller.lastName || ''}`.trim()
    : `${(booking.user as any)?.firstName || 'Customer'} ${(booking.user as any)?.lastName || ''}`.trim();

  const totalPax = (booking.travellers?.adults || 1) + (booking.travellers?.children || 0) + (booking.travellers?.infants || 0);

  const voucherData = {
    operationId: operation.operationId,
    destination: operation.destination,
    customerName,
    pax: totalPax,
    adults: booking.travellers?.adults,
    children: booking.travellers?.children,
    paymentStatus: booking.paymentStatus,
    totalAmount: booking.totalAmount,
    paidAmount: booking.paidAmount,
    isInternational: pkg?.isInternational,
    visaIncluded: pkg?.visaIncluded,
    flightsIncluded: pkg?.flightsIncluded,
    flights: pdfFlights,
    accommodations,
    transports: pdfTransports,
    itinerary,
    activities,
    transferSummary,
    packageSlug: pkg?.slug || '',
    hasPolicies,
    dateChangeHistory: booking.dateChangeHistory,
  };

  res.status(200).json({
    status: 'success',
    data: voucherData,
  });
});

// @desc    Cancel a booking
// @route   PUT /api/bookings/:id/cancel
export const cancelBooking = asyncHandler(async (req: Request, res: Response) => {
  const booking = await Booking.findById(req.params.id)
    .populate('user', 'firstName lastName email')
    .populate({
      path: 'enquiry',
      populate: { path: 'assignedTo', select: 'firstName lastName email' }
    });

  if (!booking) {
    throw new AppError('Booking not found', 404);
  }

  // Check ownership
  const userIdStr = (booking.user as any)._id ? (booking.user as any)._id.toString() : booking.user.toString();
  if (userIdStr !== req.user!._id.toString()) {
    throw new AppError('Not authorized to cancel this booking', 403);
  }

  if (!['pending', 'confirmed'].includes(booking.bookingStatus)) {
    throw new AppError('This booking cannot be cancelled', 400);
  }

  const wasConfirmed = booking.bookingStatus === 'confirmed';
  booking.bookingStatus = 'cancelled';
  booking.cancellationReason = req.body.cancellationReason;
  booking.cancelledAt = new Date();
  await booking.save();

  // Free up group tour slots if it was a confirmed booking
  if (wasConfirmed && booking.departureId && booking.package) {
    const Package = (await import('../models/Package.js')).default;
    const travellers = booking.travellers as { adults?: number; children?: number };
    const adults = travellers?.adults || 1;
    const children = travellers?.children || 0;
    
    await Package.updateOne(
      { _id: booking.package, 'departures._id': booking.departureId },
      { $inc: { 'departures.$.bookedSlots': -(adults + children) } }
    ).catch(console.error);
  }

  // Cancel ghost receivables (CustomerPayments)
  const CustomerPayment = (await import('../models/CustomerPayment.js')).default;
  await CustomerPayment.updateMany(
    { booking: booking._id, status: { $in: ['upcoming', 'overdue'] } },
    { $set: { status: 'cancelled' } }
  ).catch(console.error);

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

  // Send emails
  const customer = booking.user as any;
  const reason = req.body.cancellationReason || "No reason provided";
  const bookingDisplayId = booking.bookingId || String(booking._id).slice(-6).toUpperCase();

  if (customer.email) {
    sendBookingCancelledUserEmail(
      customer.email,
      `${customer.firstName} ${customer.lastName}`,
      bookingDisplayId,
      reason
    ).catch(console.error);
  }

  const enquiry = booking.enquiry as any;
  if (enquiry?.assignedTo?.email) {
    sendBookingCancelledStaffEmail(
      enquiry.assignedTo.email,
      `${enquiry.assignedTo.firstName} ${enquiry.assignedTo.lastName}`,
      `${customer.firstName} ${customer.lastName}`,
      bookingDisplayId,
      reason
    ).catch(console.error);
  }

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
  const { bookingStatus, paymentStatus, financeDetails } = req.body;

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
  if (financeDetails && (paymentStatus === 'paid' || paymentStatus === 'partial')) {
    // Intercept standard payment update and push to approval queue
    booking.paymentFinanceStatus = 'pending_approval';
    booking.financeDetails = {
      paidAmount: financeDetails.paidAmount,
      mode: financeDetails.mode,
      transactionId: financeDetails.transactionId,
      remarks: financeDetails.remarks,
      requestedBy: req.user!._id,
    };
    // Do NOT update booking.paymentStatus here; it will be updated when approved
  } else if (paymentStatus) {
    booking.paymentStatus = paymentStatus;
  }
  
  await booking.save();

  // Handle Group Tour Slots Update
  if ((bookingStatus === 'confirmed' || bookingStatus === 'cancelled') && booking.departureId) {
    const pkg = await Package.findById(booking.package);
    if (pkg && pkg.isGroupTour && pkg.departures) {
      const departure = pkg.departures.find(d => String(d._id) === String(booking.departureId));
      if (departure) {
        const pax = (booking.travellers?.adults || 1) + (booking.travellers?.children || 0);
        
        if (bookingStatus === 'confirmed') {
          departure.bookedSlots = (departure.bookedSlots || 0) + pax;
          if (departure.totalSlots > 0 && departure.bookedSlots >= departure.totalSlots) {
            departure.status = 'sold-out';
          }
        } else if (bookingStatus === 'cancelled') {
          departure.bookedSlots = Math.max(0, (departure.bookedSlots || 0) - pax);
          if (departure.status === 'sold-out' && (departure.totalSlots === 0 || departure.bookedSlots < departure.totalSlots)) {
            departure.status = 'available';
          }
        }
        await pkg.save();
      }
    }
  }

  // Cancel ghost receivables (CustomerPayments) when cancelled
  if (bookingStatus === 'cancelled') {
    const CustomerPayment = (await import('../models/CustomerPayment.js')).default;
    await CustomerPayment.updateMany(
      { booking: booking._id, status: { $in: ['upcoming', 'overdue'] } },
      { $set: { status: 'cancelled' } }
    ).catch(console.error);
  }

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
    await autoCreateOperationFromBooking(booking._id);
  }

  res.status(200).json({
    status: 'success',
    data: booking,
  });
});

// @desc    Update booking dates (admin/manager only)
// @route   PUT /api/bookings/:id/dates
export const updateBookingDates = asyncHandler(async (req: Request, res: Response) => {
  const { travelDate, returnDate, reason } = req.body;

  if (!travelDate) {
    throw new AppError('Travel date is required', 400);
  }
  if (!reason) {
    throw new AppError('Reason is required for changing dates', 400);
  }

  const booking = await Booking.findById(req.params.id);
  if (!booking) {
    throw new AppError('Booking not found', 404);
  }

  const oldTravelDate = booking.travelDate;
  
  booking.travelDate = new Date(travelDate);
  if (returnDate) {
    booking.returnDate = new Date(returnDate);
  } else {
    booking.returnDate = undefined;
  }
  
  booking.dateChangeHistory = booking.dateChangeHistory || [];
  booking.dateChangeHistory.push({
    oldDate: oldTravelDate,
    newDate: booking.travelDate,
    reason,
    changedBy: req.user!._id,
    changedAt: new Date()
  });

  await booking.save();

  // Cascade to Operation
  const operation = await Operation.findOne({ 
    $or: [
      { bookings: booking._id },
      { booking: booking._id }
    ]
  } as any);
  if (operation) {
    operation.travelDates = {
      start: booking.travelDate,
      end: booking.returnDate || booking.travelDate, // fallback if returnDate undefined
    };
    await operation.save();
  }

  // Cascade to Enquiry
  if (booking.enquiry) {
    await Enquiry.findByIdAndUpdate(booking.enquiry, {
      travelDate: booking.travelDate
    });
  }

  await logActivity({
    req,
    action: 'status_change',
    entity: 'booking',
    entityId: String(booking._id),
    entityName: String(booking._id),
    description: `Updated travel dates for booking #${String(booking._id).slice(-6).toUpperCase()} to ${booking.travelDate.toISOString().split('T')[0]}. Reason: ${reason}`,
    meta: { oldTravelDate, newTravelDate: booking.travelDate, reason },
  });

  res.status(200).json({
    status: 'success',
    data: booking,
  });
});

// @desc    Update booking passenger details and sync with operation
// @route   PUT /api/bookings/:id/passengers
// @access  Admin/Manager
export const updateBookingPassengers = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { travellersDetails } = req.body;

  const booking = await Booking.findById(id).populate('package');
  if (!booking) {
    throw new AppError('Booking not found', 404);
  }

  // Update booking
  booking.travellersDetails = sanitizeTravellersDetails(travellersDetails);
  await booking.save();

  // Find associated operation and sync pax
  const op = await Operation.findOne({ $or: [{ bookings: id }, { booking: id }] } as any);
  if (op) {
    const pkg = booking.package as any;
    const packageBasePax = (pkg?.adultCount || 0) + (pkg?.childCount || 0);
    const bookingTravellers = (booking.travellers?.adults || 1) + (booking.travellers?.children || 0);
    const enteredPax = travellersDetails.length;
    
    const maxPax = Math.max(packageBasePax, bookingTravellers, enteredPax, 1);
    const maxAdults = Math.max(pkg?.adultCount || booking.travellers?.adults || 1, travellersDetails.filter((t: any) => t.type === 'adult').length);
    const maxChildren = Math.max(pkg?.childCount || booking.travellers?.children || 0, travellersDetails.filter((t: any) => t.type === 'child').length);

    if (op.customers && op.customers.length > 0 && op.bookings.length <= 1) {
      op.customers[0].pax = maxPax;
      op.customers[0].adults = maxAdults;
      op.customers[0].children = maxChildren;
      op.markModified('customers');
      await op.save();
    } else if ((op as any).customer) {
      (op as any).customer.pax = maxPax;
      (op as any).customer.adults = maxAdults;
      (op as any).customer.children = maxChildren;
      op.markModified('customer');
      await op.save();
    }
  }

  res.status(200).json({ status: 'success', data: booking });
});

// @desc    Update primary traveller details for a booking
// @route   PUT /api/bookings/:id/primary-traveller
// @access  Admin/Manager/Staff
export const updateBookingPrimaryTraveller = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { firstName, lastName, email, phone, panCard } = req.body;

  const booking = await Booking.findById(id);
  if (!booking) {
    throw new AppError('Booking not found', 404);
  }

  // Safe merge — don't crash if primaryTraveller doesn't exist yet
  const existing = booking.primaryTraveller || {};
  booking.primaryTraveller = {
    firstName: firstName ?? (existing as any).firstName ?? '',
    lastName: lastName ?? (existing as any).lastName ?? '',
    email: email ?? (existing as any).email ?? '',
    phone: phone ?? (existing as any).phone ?? '',
    panCard: panCard ?? (existing as any).panCard ?? '',
  };
  await booking.save();

  // Sync with Operation — check both new (bookings[]) and legacy (booking) fields
  const op = await Operation.findOne({
    $or: [
      { bookings: id },
      { booking: id },
    ]
  } as any);

  if (op) {
    const fullName = `${firstName || ''} ${lastName || ''}`.trim();
    if (op.customers && op.customers.length > 0 && op.bookings.length <= 1) {
      // New ops — update customer snapshot
      op.customers[0].name = fullName || op.customers[0].name;
      op.customers[0].email = email || op.customers[0].email;
      op.customers[0].phone = phone || op.customers[0].phone;
      op.markModified('customers');
      await op.save();
    } else if ((op as any).customer) {
      // Legacy ops — update the customer (singular) snapshot
      (op as any).customer = {
        ...(op as any).customer,
        name: fullName || (op as any).customer.name,
        email: email || (op as any).customer.email,
        phone: phone || (op as any).customer.phone,
      };
      op.markModified('customer');
      await op.save();
    }
  }

  res.status(200).json({ status: 'success', data: booking });
});
