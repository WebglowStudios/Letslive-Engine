import { Request, Response } from 'express';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { AppError } from '../middleware/errorHandler.js';
import Coupon from '../models/Coupon.js';
import Package from '../models/Package.js';

// @desc    Create a new coupon
// @route   POST /api/coupons
// @access  Admin
export const createCoupon = asyncHandler(async (req: Request, res: Response) => {
  const { code, type, value, validPackages, minOrderValue, maxDiscount, validFrom, validUntil, usageLimit, isActive } = req.body;

  if (!code || !type || value === undefined || !validFrom || !validUntil) {
    throw new AppError('Please provide all required fields (code, type, value, validFrom, validUntil)', 400);
  }

  const existing = await Coupon.findOne({ code: code.toUpperCase() });
  if (existing) {
    throw new AppError('A coupon with this code already exists', 400);
  }

  const coupon = await Coupon.create({
    code: code.toUpperCase(),
    type,
    value,
    validPackages: validPackages || [],
    minOrderValue,
    maxDiscount,
    validFrom,
    validUntil,
    usageLimit,
    isActive: isActive !== undefined ? isActive : true,
  });

  res.status(201).json({
    status: 'success',
    data: coupon,
  });
});

// @desc    Get all coupons
// @route   GET /api/coupons
// @access  Admin
export const getCoupons = asyncHandler(async (req: Request, res: Response) => {
  const coupons = await Coupon.find().sort('-createdAt').populate('validPackages', 'name slug');
  
  res.status(200).json({
    status: 'success',
    results: coupons.length,
    data: coupons,
  });
});

// @desc    Get a single coupon
// @route   GET /api/coupons/:id
// @access  Admin
export const getCoupon = asyncHandler(async (req: Request, res: Response) => {
  const coupon = await Coupon.findById(req.params.id).populate('validPackages', 'name slug');
  if (!coupon) throw new AppError('Coupon not found', 404);

  res.status(200).json({
    status: 'success',
    data: coupon,
  });
});

// @desc    Update coupon
// @route   PUT /api/coupons/:id
// @access  Admin
export const updateCoupon = asyncHandler(async (req: Request, res: Response) => {
  if (req.body.code) req.body.code = req.body.code.toUpperCase();

  const coupon = await Coupon.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  }).populate('validPackages', 'name slug');

  if (!coupon) throw new AppError('Coupon not found', 404);

  res.status(200).json({
    status: 'success',
    data: coupon,
  });
});

// @desc    Delete coupon
// @route   DELETE /api/coupons/:id
// @access  Admin
export const deleteCoupon = asyncHandler(async (req: Request, res: Response) => {
  const coupon = await Coupon.findByIdAndDelete(req.params.id);
  if (!coupon) throw new AppError('Coupon not found', 404);

  res.status(204).json({
    status: 'success',
    data: null,
  });
});

// @desc    Validate and calculate discount for a coupon
// @route   POST /api/coupons/validate
// @access  Public
export const validateCoupon = asyncHandler(async (req: Request, res: Response) => {
  const { code, packageId, totalAmount } = req.body;

  if (!code || !totalAmount) {
    throw new AppError('Please provide coupon code and total amount', 400);
  }

  const coupon = await Coupon.findOne({ code: code.toUpperCase(), isActive: true });
  
  if (!coupon) {
    throw new AppError('Invalid or inactive coupon code', 400);
  }

  const now = new Date();
  if (now < coupon.validFrom || now > coupon.validUntil) {
    throw new AppError('This coupon is currently expired or not yet active', 400);
  }

  if (coupon.usageLimit && coupon.usedCount >= coupon.usageLimit) {
    throw new AppError('This coupon has reached its usage limit', 400);
  }

  if (coupon.minOrderValue && totalAmount < coupon.minOrderValue) {
    throw new AppError(`Minimum order value of ₹${coupon.minOrderValue} is required to use this coupon`, 400);
  }

  if (coupon.validPackages && coupon.validPackages.length > 0) {
    if (!packageId) {
       throw new AppError('This coupon is only valid for specific packages', 400);
    }
    // Check if the provided packageId is in the validPackages array
    const isValidForPackage = coupon.validPackages.some(id => id.toString() === packageId.toString());
    if (!isValidForPackage) {
      throw new AppError('This coupon is not valid for this package', 400);
    }
  }

  // Calculate discount
  let discountAmount = 0;
  if (coupon.type === 'percentage') {
    discountAmount = (totalAmount * coupon.value) / 100;
    if (coupon.maxDiscount && discountAmount > coupon.maxDiscount) {
      discountAmount = coupon.maxDiscount;
    }
  } else if (coupon.type === 'fixed') {
    discountAmount = coupon.value;
  }

  // Ensure discount doesn't exceed total amount
  if (discountAmount > totalAmount) {
    discountAmount = totalAmount;
  }

  res.status(200).json({
    status: 'success',
    data: {
      code: coupon.code,
      type: coupon.type,
      value: coupon.value,
      discountAmount,
      finalAmount: totalAmount - discountAmount,
    }
  });
});
