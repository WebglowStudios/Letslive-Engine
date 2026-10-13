import { Request, Response } from 'express';
import EmployeeTarget from '../models/EmployeeTarget.js';
import User from '../models/User.js';
import Package from '../models/Package.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { AppError } from '../middleware/errorHandler.js';

// @desc    Get targets (Admin/Manager)
// @route   GET /api/targets
export const getTargets = asyncHandler(async (req: Request, res: Response) => {
  const { user, year, periodType, month, quarter } = req.query;

  const filter: any = {};
  if (user && user !== 'all') filter.user = user;
  if (year) filter.year = parseInt(year as string);
  if (periodType && periodType !== 'all') filter.periodType = periodType;
  if (month) filter.month = parseInt(month as string);
  if (quarter) filter.quarter = parseInt(quarter as string);

  const targets = await EmployeeTarget.find(filter)
    .populate('user', 'firstName lastName email role avatar')
    .populate('setBy', 'firstName lastName')
    .populate('package', 'name destination slug')
    .sort({ year: -1, month: -1, quarter: -1, createdAt: -1 });

  res.status(200).json({
    status: 'success',
    results: targets.length,
    data: targets,
  });
});

// @desc    Create or update an employee target (Admin/Manager)
// @route   POST /api/targets
export const setEmployeeTarget = asyncHandler(async (req: Request, res: Response) => {
  const {
    user: targetUserId,
    periodType,
    year,
    month,
    quarter,
    salesTarget,
    revenueTarget,
    reviewTarget,
    package: packageId,
    notes,
  } = req.body;

  if (!targetUserId) {
    throw new AppError('Employee (user) is required', 400);
  }
  if (!periodType || !['monthly', 'quarterly', 'yearly'].includes(periodType)) {
    throw new AppError('Valid periodType (monthly, quarterly, yearly) is required', 400);
  }
  if (!year) {
    throw new AppError('Year is required', 400);
  }

  // Resolve package name if packageId is passed
  let resolvedPackageName: string | undefined;
  if (packageId) {
    const pkg = await Package.findById(packageId).select('name');
    if (pkg) resolvedPackageName = pkg.name;
  }

  const queryMatch: any = {
    user: targetUserId,
    periodType,
    year: parseInt(year),
  };
  if (periodType === 'monthly') queryMatch.month = parseInt(month || 1);
  if (periodType === 'quarterly') queryMatch.quarter = parseInt(quarter || 1);

  const updateData: any = {
    user: targetUserId,
    periodType,
    year: parseInt(year),
    month: periodType === 'monthly' ? parseInt(month || 1) : undefined,
    quarter: periodType === 'quarterly' ? parseInt(quarter || 1) : undefined,
    salesTarget: Math.max(0, Number(salesTarget) || 0),
    revenueTarget: Math.max(0, Number(revenueTarget) || 0),
    reviewTarget: Math.max(0, Number(reviewTarget) || 0),
    package: packageId || undefined,
    packageName: resolvedPackageName || undefined,
    notes: notes || undefined,
    setBy: req.user!._id,
  };

  const target = await EmployeeTarget.findOneAndUpdate(
    queryMatch,
    updateData,
    { new: true, upsert: true, runValidators: true }
  )
    .populate('user', 'firstName lastName email role')
    .populate('setBy', 'firstName lastName')
    .populate('package', 'name');

  res.status(200).json({
    status: 'success',
    data: target,
  });
});

// @desc    Delete a target (Admin/Manager)
// @route   DELETE /api/targets/:id
export const deleteTarget = asyncHandler(async (req: Request, res: Response) => {
  const target = await EmployeeTarget.findByIdAndDelete(req.params.id);
  if (!target) {
    throw new AppError('Target not found', 404);
  }

  res.status(200).json({
    status: 'success',
    message: 'Target deleted successfully',
  });
});
