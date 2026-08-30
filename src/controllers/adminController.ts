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
    role: { $in: ['admin', 'manager', 'sales-manager', 'ops-manager', 'sales-staff', 'ops-staff', 'staff', 'guest'] },
  }).sort({ createdAt: -1 });

  res.status(200).json({
    status: 'success',
    results: staff.length,
    data: staff,
  });
});

// @desc    Create a staff member OR customer account
// @route   POST /api/admin/staff
export const createStaff = asyncHandler(async (req: Request, res: Response) => {
  const { firstName, lastName, email, role, password, phone, enquiryId } = req.body;

  if (!firstName || !lastName || !email || !password) {
    throw new AppError('Please provide all required fields', 400);
  }

  const requestingRole = req.user!.role;

  // Non-admins can only create customer accounts (user/guest)
  const adminRoles = ['admin'];
  const customerRoles = ['user', 'guest'];
  const allAllowed = ['admin', 'manager', 'sales-manager', 'ops-manager', 'sales-staff', 'ops-staff', 'staff', 'user', 'guest'];

  if (!allAllowed.includes(role)) {
    throw new AppError('Invalid role', 400);
  }

  if (!adminRoles.includes(requestingRole) && !customerRoles.includes(role)) {
    throw new AppError('You do not have permission to create accounts with this role', 403);
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
    phone: phone || undefined,
    role: role || 'user',
    isVerified: true, // Admin-created accounts skip email verification
    isActive: true,
  });

  // If enquiryId provided, link this user account back to the enquiry
  if (enquiryId) {
    await Enquiry.findByIdAndUpdate(enquiryId, { user: user._id });
  }

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
  const { role, isActive, avatar, description, password, customPermissions } = req.body;
  const updateData: Record<string, unknown> = {};

  if (role) {
    const allowedRoles = ['admin', 'manager', 'sales-manager', 'ops-manager', 'sales-staff', 'ops-staff', 'guest', 'user', 'staff'];
    if (!allowedRoles.includes(role)) {
      throw new AppError('Invalid role', 400);
    }
    updateData.role = role;
  }

  if (typeof isActive === 'boolean') {
    updateData.isVerified = isActive; // Using isVerified as active flag for staff
  }

  if (avatar !== undefined) updateData.avatar = avatar;
  if (description !== undefined) updateData.description = description;
  if (customPermissions !== undefined && Array.isArray(customPermissions)) {
    updateData.customPermissions = customPermissions;
  }

  const user = await User.findById(req.params.id);
  if (!user) {
    throw new AppError('Staff member not found', 404);
  }

  if (password) {
    user.password = password;
    await user.save(); // Trigger pre-save hook for password hash
  }

  if (Object.keys(updateData).length > 0) {
    await User.findByIdAndUpdate(req.params.id, updateData, { runValidators: true });
  }

  const updatedUser = await User.findById(req.params.id);

  res.status(200).json({
    status: 'success',
    data: updatedUser,
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
