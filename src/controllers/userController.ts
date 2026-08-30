import { Request, Response } from 'express';
import User from '../models/User.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { AppError } from '../middleware/errorHandler.js';
import Enquiry from '../models/Enquiry.js';
import Operation from '../models/Operation.js';
import '../models/Booking.js'; // Side-effect import to ensure Schema is registered for populate
import mongoose from 'mongoose';

// @desc    Get all users (admin)
// @route   GET /api/users
export const getAllUsers = asyncHandler(async (req: Request, res: Response) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 10;
  const skip = (page - 1) * limit;

  const [users, total] = await Promise.all([
    User.find().select('-password').sort({ createdAt: -1 }).skip(skip).limit(limit),
    User.countDocuments(),
  ]);

  res.status(200).json({
    status: 'success',
    results: users.length,
    total,
    page,
    pages: Math.ceil(total / limit),
    data: users,
  });
});

// @desc    Get staff list (for reassign dropdowns — any auth user)
// @route   GET /api/users/staff
export const getStaffList = asyncHandler(async (_req: Request, res: Response) => {
  const staff = await User.find({
    role: { $in: ['admin', 'manager', 'staff'] },
  })
    .select('_id firstName lastName email role')
    .sort({ firstName: 1 });

  res.status(200).json({
    status: 'success',
    data: staff,
  });
});


// @desc    Get user by ID (admin)
// @route   GET /api/users/:id
export const getUserById = asyncHandler(async (req: Request, res: Response) => {
  const user = await User.findById(req.params.id).select('-password');

  if (!user) {
    throw new AppError('User not found', 404);
  }

  res.status(200).json({
    status: 'success',
    data: user,
  });
});

// @desc    Update profile (user)
// @route   PUT /api/users/profile
export const updateProfile = asyncHandler(async (req: Request, res: Response) => {
  const { firstName, lastName, phone, avatar } = req.body;

  const user = await User.findByIdAndUpdate(
    req.user!._id,
    { firstName, lastName, phone, avatar },
    { new: true, runValidators: true }
  ).select('-password');

  res.status(200).json({
    status: 'success',
    data: user,
  });
});

// @desc    Change password (user)
// @route   PUT /api/users/password
export const changePassword = asyncHandler(async (req: Request, res: Response) => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    throw new AppError('Please provide current and new password', 400);
  }

  const user = await User.findById(req.user!._id).select('+password');
  if (!user) {
    throw new AppError('User not found', 404);
  }

  const isMatch = await user.comparePassword(currentPassword);
  if (!isMatch) {
    throw new AppError('Current password is incorrect', 401);
  }

  user.password = newPassword;
  await user.save();

  res.status(200).json({
    status: 'success',
    message: 'Password updated successfully',
  });
});

// @desc    Add to wishlist (user)
// @route   POST /api/users/wishlist/:packageId
export const addToWishlist = asyncHandler(async (req: Request, res: Response) => {
  const user = await User.findByIdAndUpdate(
    req.user!._id,
    { $addToSet: { wishlist: req.params.packageId } },
    { new: true }
  ).select('-password');

  res.status(200).json({
    status: 'success',
    data: user?.wishlist,
  });
});

// @desc    Remove from wishlist (user)
// @route   DELETE /api/users/wishlist/:packageId
export const removeFromWishlist = asyncHandler(async (req: Request, res: Response) => {
  const user = await User.findByIdAndUpdate(
    req.user!._id,
    { $pull: { wishlist: req.params.packageId } },
    { new: true }
  ).select('-password');

  res.status(200).json({
    status: 'success',
    data: user?.wishlist,
  });
});

// @desc    Get wishlist (user)
// @route   GET /api/users/wishlist
export const getWishlist = asyncHandler(async (req: Request, res: Response) => {
  const user = await User.findById(req.user!._id)
    .populate('wishlist', 'name slug images price destination duration rating')
    .select('wishlist');

  res.status(200).json({
    status: 'success',
    results: user?.wishlist?.length || 0,
    data: user?.wishlist || [],
  });
});

// @desc    Delete user (admin)
// @route   DELETE /api/users/:id
export const deleteUser = asyncHandler(async (req: Request, res: Response) => {
  const user = await User.findByIdAndDelete(req.params.id);

  if (!user) {
    throw new AppError('User not found', 404);
  }

  res.status(204).json({
    status: 'success',
    data: null,
  });
});

// @desc    Update user password (admin)
// @route   PUT /api/users/:id/password
export const updateUserPassword = asyncHandler(async (req: Request, res: Response) => {
  const { password } = req.body;

  if (!password || password.length < 8) {
    throw new AppError('Password must be at least 8 characters', 400);
  }

  const user = await User.findById(req.params.id);
  if (!user) {
    throw new AppError('User not found', 404);
  }

  user.password = password;
  await user.save();

  res.status(200).json({
    status: 'success',
    message: 'User password updated successfully',
  });
});

// @desc    Search user by email (staff use: customer lookup for manual bookings)
// @route   GET /api/users/search?email=...
export const searchUserByEmail = asyncHandler(async (req: Request, res: Response) => {
  const email = (req.query.email as string || '').trim().toLowerCase();
  if (!email) throw new AppError('Email query parameter is required', 400);

  const user = await User.findOne({ email }).select('_id firstName lastName email phone role createdAt').lean();
  if (!user) throw new AppError('No account found with this email', 404);

  res.status(200).json({ status: 'success', data: user });
});

// @route   GET /api/users/:id/performance
export const getUserPerformance = asyncHandler(async (req: Request, res: Response) => {
  const targetId = req.params.id === 'me' ? req.user!._id : req.params.id;
  
  if (req.params.id !== 'me' && req.user!.role !== 'admin' && req.user!.role !== 'manager') {
    throw new AppError('Not authorized to view other users performance', 403);
  }

  const userId = new mongoose.Types.ObjectId(String(targetId));
  console.log('[PERF DEBUG] targetId raw:', targetId, '| type:', typeof targetId);
  console.log('[PERF DEBUG] userId as ObjectId:', userId);

  // 1. Inquiries Managed & Conversions
  const enquiriesStats = await Enquiry.aggregate([
    { $match: { assignedTo: userId } },
    {
      $group: {
        _id: null,
        totalManaged: { $sum: 1 },
        totalConverted: { $sum: { $cond: [{ $eq: ['$status', 'converted'] }, 1, 0] } }
      }
    }
  ]);

  const inquiriesManaged = enquiriesStats[0]?.totalManaged || 0;
  const conversions = enquiriesStats[0]?.totalConverted || 0;

  // 2. Revenue, Profit & Clients Handled (Operations)
  const opsStats = await Operation.aggregate([
    { $match: { assignedTo: userId } },
    {
      $group: {
        _id: null,
        clientsHandled: { $sum: 1 }, // counting number of operations handled
        totalRevenue: { $sum: '$sellingPrice' },
        totalProfit: { $sum: '$grossProfit' }
      }
    }
  ]);

  const clientsHandled = opsStats[0]?.clientsHandled || 0;
  const revenueGenerated = opsStats[0]?.totalRevenue || 0;
  const profitGenerated = opsStats[0]?.totalProfit || 0;
  console.log('[PERF DEBUG] enquiriesStats:', JSON.stringify(enquiriesStats));
  console.log('[PERF DEBUG] opsStats:', JSON.stringify(opsStats));

  // 3. Incentives (Fixed 5% of gross profit as a standard mock metric)
  const incentivesEarned = profitGenerated * 0.05;

  // Recent Conversions/Bookings for activity table
  const recentOperations = await Operation.find({ assignedTo: userId })
    .sort({ createdAt: -1 })
    .limit(5)
    .populate('booking', 'bookingId totalAmount');

  res.status(200).json({
    status: 'success',
    data: {
      inquiriesManaged,
      conversions,
      clientsHandled,
      revenueGenerated,
      profitGenerated,
      incentivesEarned,
      recentActivity: recentOperations
    }
  });
});
