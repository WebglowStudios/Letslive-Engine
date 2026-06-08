import { Request, Response } from 'express';
import Destination from '../models/Destination.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { AppError } from '../middleware/errorHandler.js';

// @desc    Get all destinations with filtering, search, sort, pagination
// @route   GET /api/destinations
export const getDestinations = asyncHandler(async (req: Request, res: Response) => {
  const {
    category,
    search,
    visaType,
    isFeatured,
    sort,
    page = '1',
    limit = '12',
    admin,
  } = req.query;

  const query: Record<string, unknown> = { isActive: true };

  // Only filter by approval for public requests (not admin dashboard)
  if (!admin) {
    query.approvalStatus = { $nin: ['pending', 'rejected'] };
  }

  if (category) {
    query.category = category;
  }

  if (visaType) {
    query.visaType = visaType;
  }

  if (isFeatured === 'true') {
    query.isFeatured = true;
  }

  if (search) {
    const searchRegex = new RegExp(search as string, 'i');
    query.$or = [
      { name: searchRegex },
      { region: searchRegex },
      { description: searchRegex },
    ];
  }

  // Sort options
  let sortOption: Record<string, 1 | -1> = { createdAt: -1 };
  if (sort) {
    switch (sort) {
      case 'name':
        sortOption = { name: 1 };
        break;
      case 'price':
        sortOption = { startingPrice: 1 };
        break;
      case '-price':
        sortOption = { startingPrice: -1 };
        break;
      case 'rating':
        sortOption = { rating: 1 };
        break;
      case '-rating':
        sortOption = { rating: -1 };
        break;
    }
  }

  const pageNum = parseInt(page as string, 10) || 1;
  const limitNum = parseInt(limit as string, 10) || 12;
  const skip = (pageNum - 1) * limitNum;

  const [destinations, total] = await Promise.all([
    Destination.find(query).sort(sortOption).skip(skip).limit(limitNum),
    Destination.countDocuments(query),
  ]);

  res.status(200).json({
    status: 'success',
    results: destinations.length,
    total,
    page: pageNum,
    pages: Math.ceil(total / limitNum),
    data: destinations,
  });
});

// @desc    Get featured destinations
// @route   GET /api/destinations/featured
export const getFeaturedDestinations = asyncHandler(async (_req: Request, res: Response) => {
  const destinations = await Destination.find({ isFeatured: true, isActive: true, approvalStatus: { $nin: ['pending', 'rejected'] } }).limit(6);

  res.status(200).json({
    status: 'success',
    results: destinations.length,
    data: destinations,
  });
});

// @desc    Get single destination by slug or ID
// @route   GET /api/destinations/:slug
export const getDestinationBySlug = asyncHandler(async (req: Request, res: Response) => {
  const param = req.params.slug as string;

  // Try by slug first, then by _id
  let destination = await Destination.findOne({ slug: param });

  if (!destination && param.match(/^[0-9a-fA-F]{24}$/)) {
    destination = await Destination.findById(param);
  }

  if (!destination) {
    throw new AppError('Destination not found', 404);
  }

  res.status(200).json({
    status: 'success',
    data: destination,
  });
});

// @desc    Create a destination
// @route   POST /api/destinations
export const createDestination = asyncHandler(async (req: Request, res: Response) => {
  const destination = await Destination.create(req.body);

  res.status(201).json({
    status: 'success',
    data: destination,
  });
});

// @desc    Update a destination
// @route   PUT /api/destinations/:id
export const updateDestination = asyncHandler(async (req: Request, res: Response) => {
  const destination = await Destination.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });

  if (!destination) {
    throw new AppError('Destination not found', 404);
  }

  res.status(200).json({
    status: 'success',
    data: destination,
  });
});

// @desc    Delete a destination
// @route   DELETE /api/destinations/:id
export const deleteDestination = asyncHandler(async (req: Request, res: Response) => {
  const destination = await Destination.findByIdAndDelete(req.params.id);

  if (!destination) {
    throw new AppError('Destination not found', 404);
  }

  res.status(204).json({
    status: 'success',
    data: null,
  });
});
