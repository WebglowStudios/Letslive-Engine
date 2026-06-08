import { Request, Response } from 'express';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { AppError } from '../middleware/errorHandler.js';
import User from '../models/User.js';
import { env } from '../config/env.js';
import {
  generateAccessToken,
  generateRefreshToken,
  setTokenCookies,
} from '../utils/generateToken.js';
import {
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from '../validations/auth.js';
import { sendVerificationEmail, sendResetPasswordEmail } from '../services/emailService.js';

interface JwtPayload {
  id: string;
  iat: number;
  exp: number;
}

// @desc    Register a new user
// @route   POST /api/auth/register
export const register = asyncHandler(async (req: Request, res: Response) => {
  const data = registerSchema.parse(req.body);

  // Check if user already exists
  const existingUser = await User.findOne({ email: data.email });
  if (existingUser) {
    throw new AppError('Email already registered', 400);
  }

  // Create user
  const user = await User.create(data);

  // Generate verification token
  const rawToken = user.createVerificationToken();
  await user.save({ validateBeforeSave: false });

  // Send verification email (fire-and-forget)
  sendVerificationEmail(user.email, rawToken, user.firstName).catch((err) =>
    console.error('Failed to send verification email:', err)
  );

  // Generate auth tokens
  const accessToken = generateAccessToken(String(user._id));
  const refreshToken = generateRefreshToken(String(user._id));
  setTokenCookies(res, accessToken, refreshToken);

  // Remove password from response
  const userObj = user.toObject();
  delete (userObj as unknown as Record<string, unknown>).password;

  res.status(201).json({
    status: 'success',
    message: 'Registration successful',
    data: {
      user: userObj,
      // Return token in dev mode for testing
      ...(env.NODE_ENV === 'development' && { verificationToken: rawToken }),
    },
  });
});

// @desc    Login user
// @route   POST /api/auth/login
export const login = asyncHandler(async (req: Request, res: Response) => {
  const data = loginSchema.parse(req.body);

  // Find user with password field
  const user = await User.findOne({ email: data.email }).select('+password');
  if (!user) {
    throw new AppError('Invalid email or password', 401);
  }

  // Check if account is locked
  if (user.lockUntil && user.lockUntil > new Date()) {
    throw new AppError('Account is temporarily locked. Please try again later.', 423);
  }

  // Compare password
  const isMatch = await user.comparePassword(data.password);
  if (!isMatch) {
    // Increment login attempts
    user.loginAttempts += 1;
    if (user.loginAttempts >= 5) {
      user.lockUntil = new Date(Date.now() + 30 * 60 * 1000); // Lock for 30 minutes
    }
    await user.save({ validateBeforeSave: false });
    throw new AppError('Invalid email or password', 401);
  }

  // Reset login attempts on successful login
  if (user.loginAttempts > 0) {
    user.loginAttempts = 0;
    user.lockUntil = undefined;
    await user.save({ validateBeforeSave: false });
  }

  // Generate tokens
  const accessToken = generateAccessToken(String(user._id));
  const refreshToken = generateRefreshToken(String(user._id));
  setTokenCookies(res, accessToken, refreshToken);

  // Remove password from response
  const userObj = user.toObject();
  delete (userObj as unknown as Record<string, unknown>).password;

  res.status(200).json({
    status: 'success',
    data: { user: userObj },
  });
});

// @desc    Logout user
// @route   POST /api/auth/logout
export const logout = asyncHandler(async (_req: Request, res: Response) => {
  res.cookie('accessToken', '', { httpOnly: true, expires: new Date(0) });
  res.cookie('refreshToken', '', { httpOnly: true, expires: new Date(0) });

  res.status(200).json({
    status: 'success',
    message: 'Logged out successfully',
  });
});

// @desc    Get current user
// @route   GET /api/auth/me
export const getMe = asyncHandler(async (req: Request, res: Response) => {
  res.status(200).json({
    status: 'success',
    data: { user: req.user },
  });
});

// @desc    Refresh access token
// @route   POST /api/auth/refresh
export const refreshTokenHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const token = req.cookies?.refreshToken;

    if (!token) {
      throw new AppError('No refresh token provided', 401);
    }

    const decoded = jwt.verify(token, env.JWT_REFRESH_SECRET) as JwtPayload;

    const user = await User.findById(decoded.id);
    if (!user) {
      throw new AppError('User not found', 401);
    }

    // Generate new access token
    const accessToken = generateAccessToken(String(user._id));
    res.cookie('accessToken', accessToken, {
      httpOnly: true,
      secure: env.NODE_ENV === 'production',
      sameSite: env.NODE_ENV === 'production' ? 'none' : 'strict',
      maxAge: 15 * 60 * 1000,
    });

    res.status(200).json({
      status: 'success',
      message: 'Token refreshed',
    });
  }
);

// @desc    Forgot password
// @route   POST /api/auth/forgot-password
export const forgotPassword = asyncHandler(async (req: Request, res: Response) => {
  const data = forgotPasswordSchema.parse(req.body);

  const user = await User.findOne({ email: data.email });
  if (!user) {
    throw new AppError('No user found with that email', 404);
  }

  // Generate reset token
  const rawToken = user.createResetToken();
  await user.save({ validateBeforeSave: false });

  // Send reset password email (fire-and-forget)
  sendResetPasswordEmail(user.email, rawToken, user.firstName).catch((err) =>
    console.error('Failed to send reset password email:', err)
  );

  // Skip sending email for now, return token in dev mode
  res.status(200).json({
    status: 'success',
    message: 'Password reset token generated',
    ...(env.NODE_ENV === 'development' && { resetToken: rawToken }),
  });
});

// @desc    Reset password
// @route   POST /api/auth/reset-password/:token
export const resetPassword = asyncHandler(async (req: Request, res: Response) => {
  const data = resetPasswordSchema.parse(req.body);

  // Hash the token from params
  const token = req.params.token as string;
  const hashedToken = crypto
    .createHash('sha256')
    .update(token)
    .digest('hex');

  // Find user with matching token that hasn't expired
  const user = await User.findOne({
    resetPasswordToken: hashedToken,
    resetPasswordExpires: { $gt: new Date() },
  });

  if (!user) {
    throw new AppError('Token is invalid or has expired', 400);
  }

  // Set new password and clear reset fields
  user.password = data.password;
  user.resetPasswordToken = undefined;
  user.resetPasswordExpires = undefined;
  await user.save();

  res.status(200).json({
    status: 'success',
    message: 'Password reset successful',
  });
});

// @desc    Verify email
// @route   GET /api/auth/verify-email/:token
export const verifyEmail = asyncHandler(async (req: Request, res: Response) => {
  // Hash the token from params
  const token = req.params.token as string;
  const hashedToken = crypto
    .createHash('sha256')
    .update(token)
    .digest('hex');

  // Find user with matching token that hasn't expired
  const user = await User.findOne({
    verificationToken: hashedToken,
    verificationTokenExpires: { $gt: new Date() },
  });

  if (!user) {
    throw new AppError('Token is invalid or has expired', 400);
  }

  // Set verified and clear verification fields
  user.isVerified = true;
  user.verificationToken = undefined;
  user.verificationTokenExpires = undefined;
  await user.save({ validateBeforeSave: false });

  res.status(200).json({
    status: 'success',
    message: 'Email verified successfully',
  });
});
