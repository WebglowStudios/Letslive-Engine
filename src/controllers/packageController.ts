import { Request, Response } from 'express';
import Package from '../models/Package.js';
import Destination from '../models/Destination.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { AppError } from '../middleware/errorHandler.js';
import { logActivity } from '../utils/logActivity.js';

// @desc    Get all packages with filtering, search, sort, pagination
// @route   GET /api/packages
export const getPackages = asyncHandler(async (req: Request, res: Response) => {
  const {
    destination,
    category,
    badge,
    search,
    minPrice,
    maxPrice,
    sort,
    page = '1',
    limit = '12',
    admin,
  } = req.query;

  const query: Record<string, unknown> = {};

  // For admin dashboard: show all packages (including inactive)
  // For public: only show active, non-custom packages
  if (!admin) {
    query.isActive = true;
    query.isCustom = { $ne: true };
    query.approvalStatus = { $nin: ['pending', 'rejected'] };
  } else {
    // Admin still excludes custom itineraries (they have their own page)
    query.isCustom = { $ne: true };
  }

  if (destination) {
    query.destination = destination;
  }

  if (category) {
    query.category = category;
  }

  if (badge) {
    query.badge = badge;
  }

  if (search) {
    const searchRegex = new RegExp(search as string, 'i');
    query.$or = [{ name: searchRegex }, { description: searchRegex }];
  }

  if (minPrice || maxPrice) {
    query.price = {};
    if (minPrice) (query.price as Record<string, unknown>).$gte = Number(minPrice);
    if (maxPrice) (query.price as Record<string, unknown>).$lte = Number(maxPrice);
  }

  // Sort options
  let sortOption: Record<string, 1 | -1> = { createdAt: -1 };
  if (sort) {
    switch (sort) {
      case 'price':
        sortOption = { price: 1 };
        break;
      case '-price':
        sortOption = { price: -1 };
        break;
      case 'rating':
        sortOption = { rating: 1 };
        break;
      case '-rating':
        sortOption = { rating: -1 };
        break;
      case 'newest':
        sortOption = { createdAt: -1 };
        break;
    }
  }

  const pageNum = parseInt(page as string, 10) || 1;
  const limitNum = parseInt(limit as string, 10) || 12;
  const skip = (pageNum - 1) * limitNum;

  const [packages, total] = await Promise.all([
    Package.find(query)
      .populate('destination', 'name slug')
      .sort(sortOption)
      .skip(skip)
      .limit(limitNum),
    Package.countDocuments(query),
  ]);

  res.status(200).json({
    status: 'success',
    results: packages.length,
    total,
    page: pageNum,
    pages: Math.ceil(total / limitNum),
    data: packages,
  });
});

// @desc    Get featured packages
// @route   GET /api/packages/featured
export const getFeaturedPackages = asyncHandler(async (_req: Request, res: Response) => {
  const packages = await Package.find({ isFeatured: true, isActive: true, isCustom: { $ne: true }, approvalStatus: { $nin: ['pending', 'rejected'] } })
    .populate('destination', 'name slug')
    .limit(8);

  res.status(200).json({
    status: 'success',
    results: packages.length,
    data: packages,
  });
});

// @desc    Get single package by slug or ID
// @route   GET /api/packages/:slug
export const getPackageBySlug = asyncHandler(async (req: Request, res: Response) => {
  const param = req.params.slug as string;

  // Try by slug first, then by _id
  let pkg = await Package.findOne({ slug: param }).populate(
    'destination',
    'name slug country region'
  );

  if (!pkg && param.match(/^[0-9a-fA-F]{24}$/)) {
    pkg = await Package.findById(param).populate(
      'destination',
      'name slug country region'
    );
  }

  if (!pkg) {
    throw new AppError('Package not found', 404);
  }

  res.status(200).json({
    status: 'success',
    data: pkg,
  });
});

// @desc    Get packages by destination slug
// @route   GET /api/packages/destination/:destSlug
export const getPackagesByDestination = asyncHandler(async (req: Request, res: Response) => {
  const { category, sort } = req.query;

  const destination = await Destination.findOne({ slug: req.params.destSlug });

  if (!destination) {
    throw new AppError('Destination not found', 404);
  }

  const query: Record<string, unknown> = {
    destination: destination._id,
    isActive: true,
    approvalStatus: { $nin: ['pending', 'rejected'] },
    // Custom itineraries only appear if explicitly enabled
    $or: [
      { isCustom: { $ne: true } },
      { isCustom: true, showOnDestination: true },
    ],
  };

  if (category) {
    query.category = category;
  }

  let sortOption: Record<string, 1 | -1> = { createdAt: -1 };
  if (sort) {
    switch (sort) {
      case 'price':
        sortOption = { price: 1 };
        break;
      case '-price':
        sortOption = { price: -1 };
        break;
      case 'rating':
        sortOption = { rating: 1 };
        break;
      case '-rating':
        sortOption = { rating: -1 };
        break;
    }
  }

  const packages = await Package.find(query)
    .populate('destination', 'name slug')
    .sort(sortOption);

  res.status(200).json({
    status: 'success',
    results: packages.length,
    data: packages,
  });
});

// @desc    Create a package
// @route   POST /api/packages
export const createPackage = asyncHandler(async (req: Request, res: Response) => {
  if (req.body.isCustom && req.user) {
    req.body.createdBy = req.user._id;
  }
  // Strip empty destination to avoid ObjectId cast error
  if (!req.body.destination) {
    delete req.body.destination;
  }
  const pkg = await Package.create(req.body);

  if (pkg.destination) {
    await Destination.findByIdAndUpdate(pkg.destination, { $inc: { packageCount: 1 } });
  }

  await logActivity({
    req,
    action: 'create',
    entity: 'package',
    entityId: String(pkg._id),
    entityName: pkg.name,
    description: `Created package "${pkg.name}"`,
  });

  res.status(201).json({ status: 'success', data: pkg });
});

// @desc    Update a package
// @route   PUT /api/packages/:id
export const updatePackage = asyncHandler(async (req: Request, res: Response) => {
  // Strip empty destination to avoid ObjectId cast error
  if (!req.body.destination) {
    delete req.body.destination;
  }
  const pkg = await Package.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });

  if (!pkg) {
    throw new AppError('Package not found', 404);
  }

  // Detect approval status change
  const action = req.body.approvalStatus ? 'approve' : 'update';
  const description = req.body.approvalStatus
    ? `Changed package "${pkg.name}" approval to ${req.body.approvalStatus}`
    : `Updated package "${pkg.name}"`;

  await logActivity({
    req,
    action,
    entity: 'package',
    entityId: String(pkg._id),
    entityName: pkg.name,
    description,
    meta: req.body.approvalStatus ? { approvalStatus: req.body.approvalStatus } : undefined,
  });

  res.status(200).json({ status: 'success', data: pkg });
});

// @desc    Delete a package
// @route   DELETE /api/packages/:id
export const deletePackage = asyncHandler(async (req: Request, res: Response) => {
  const pkg = await Package.findByIdAndDelete(req.params.id);

  if (!pkg) {
    throw new AppError('Package not found', 404);
  }

  if (pkg.destination) {
    await Destination.findByIdAndUpdate(pkg.destination, { $inc: { packageCount: -1 } });
  }

  await logActivity({
    req,
    action: 'delete',
    entity: 'package',
    entityId: String(pkg._id),
    entityName: pkg.name,
    description: `Deleted package "${pkg.name}"`,
  });

  res.status(204).json({ status: 'success', data: null });
});
