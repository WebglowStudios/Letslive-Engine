import { Request, Response } from 'express';
import User from '../models/User.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { AppError } from '../middleware/errorHandler.js';

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
