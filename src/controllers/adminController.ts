import { Request, Response } from 'express';
import User from '../models/User.js';
import Booking from '../models/Booking.js';
import Destination from '../models/Destination.js';
import Package from '../models/Package.js';
import Review from '../models/Review.js';
import Enquiry from '../models/Enquiry.js';
import Newsletter from '../models/Newsletter.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { AppError } from '../middleware/errorHandler.js';

// @desc    Get dashboard stats
// @route   GET /api/admin/stats
export const getDashboardStats = asyncHandler(async (_req: Request, res: Response) => {
  const [
    totalBookings,
    totalUsers,
    totalPackages,
    totalDestinations,
    pendingBookings,
    pendingReviews,
    newEnquiries,
    totalSubscribers,
  ] = await Promise.all([
    Booking.countDocuments(),
    User.countDocuments({ role: 'user' }),
    Package.countDocuments({ isActive: true }),
    Destination.countDocuments({ isActive: true }),
    Booking.countDocuments({ status: 'pending' }),
    Review.countDocuments({ isApproved: false }),
    Enquiry.countDocuments({ status: 'new' }),
    Newsletter.countDocuments({ isSubscribed: true }),
  ]);

  // Calculate total revenue from completed bookings
  const revenueResult = await Booking.aggregate([
    { $match: { status: { $in: ['confirmed', 'completed'] } } },
    { $group: { _id: null, total: { $sum: '$totalAmount' } } },
  ]);
  const totalRevenue = revenueResult[0]?.total || 0;

  res.status(200).json({
    status: 'success',
    data: {
      totalBookings,
      totalRevenue,
      totalUsers,
      totalPackages,
      totalDestinations,
      pendingBookings,
      pendingReviews,
      newEnquiries,
      totalSubscribers,
    },
  });
});

// @desc    Get all staff members (admin, manager, staff, guest roles)
// @route   GET /api/admin/staff
export const getStaff = asyncHandler(async (_req: Request, res: Response) => {
  const staff = await User.find({
    role: { $in: ['admin', 'manager', 'staff', 'guest'] },
  }).sort({ createdAt: -1 });

  res.status(200).json({
    status: 'success',
    results: staff.length,
    data: staff,
  });
});

// @desc    Create a staff member
// @route   POST /api/admin/staff
export const createStaff = asyncHandler(async (req: Request, res: Response) => {
  const { firstName, lastName, email, role, password } = req.body;

  if (!firstName || !lastName || !email || !password) {
    throw new AppError('Please provide all required fields', 400);
  }

  const allowedRoles = ['admin', 'manager', 'staff', 'guest'];
  if (!allowedRoles.includes(role)) {
    throw new AppError('Invalid role', 400);
  }

  // Check if email already exists
  const existing = await User.findOne({ email: email.toLowerCase() });
  if (existing) {
    throw new AppError('Email already in use', 400);
  }

  const user = await User.create({
    firstName,
    lastName,
    email: email.toLowerCase(),
    password,
    role,
    isVerified: true, // Staff accounts are pre-verified
  });

  // Remove password from response
  const userObj = user.toObject() as unknown as Record<string, unknown>;
  delete userObj.password;

  res.status(201).json({
    status: 'success',
    data: userObj,
  });
});

// @desc    Update staff member (role, active status)
// @route   PUT /api/admin/staff/:id
export const updateStaff = asyncHandler(async (req: Request, res: Response) => {
  const { role, isActive } = req.body;
  const updateData: Record<string, unknown> = {};

  if (role) {
    const allowedRoles = ['admin', 'manager', 'staff', 'guest'];
    if (!allowedRoles.includes(role)) {
      throw new AppError('Invalid role', 400);
    }
    updateData.role = role;
  }

  if (typeof isActive === 'boolean') {
    updateData.isVerified = isActive; // Using isVerified as active flag for staff
  }

  const user = await User.findByIdAndUpdate(req.params.id, updateData, {
    new: true,
    runValidators: true,
  });

  if (!user) {
    throw new AppError('Staff member not found', 404);
  }

  res.status(200).json({
    status: 'success',
    data: user,
  });
});

// @desc    Delete staff member
// @route   DELETE /api/admin/staff/:id
export const deleteStaff = asyncHandler(async (req: Request, res: Response) => {
  const user = await User.findById(req.params.id);

  if (!user) {
    throw new AppError('Staff member not found', 404);
  }

  // Prevent deleting yourself
  if (user._id.toString() === req.user!._id.toString()) {
    throw new AppError('You cannot delete your own account', 400);
  }

  await User.findByIdAndDelete(req.params.id);

  res.status(204).json({
    status: 'success',
    data: null,
  });
});
