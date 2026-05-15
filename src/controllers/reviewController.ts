import { Request, Response } from 'express';
import Review from '../models/Review.js';
import Package from '../models/Package.js';
import Destination from '../models/Destination.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { AppError } from '../middleware/errorHandler.js';

// Helper: Recalculate ratings for a package and its destination
const recalculateRatings = async (packageId: unknown, destinationId?: unknown) => {
  const packageStats = await Review.aggregate([
    { $match: { package: packageId, isApproved: true } },
    {
      $group: {
        _id: '$package',
        avgRating: { $avg: '$rating' },
        count: { $sum: 1 },
      },
    },
  ]);

  if (packageStats.length > 0) {
    await Package.findByIdAndUpdate(packageId, {
      rating: Math.round(packageStats[0].avgRating * 10) / 10,
      reviewCount: packageStats[0].count,
    });
  } else {
    await Package.findByIdAndUpdate(packageId, {
      rating: 0,
      reviewCount: 0,
    });
  }

  // Also update destination rating if destinationId provided
  if (destinationId) {
    const destStats = await Review.aggregate([
      { $match: { destination: destinationId, isApproved: true } },
      {
        $group: {
          _id: '$destination',
          avgRating: { $avg: '$rating' },
          count: { $sum: 1 },
        },
      },
    ]);

    if (destStats.length > 0) {
      await Destination.findByIdAndUpdate(destinationId, {
        rating: Math.round(destStats[0].avgRating * 10) / 10,
        reviewCount: destStats[0].count,
      });
    } else {
      await Destination.findByIdAndUpdate(destinationId, {
        rating: 0,
        reviewCount: 0,
      });
    }
  }
};

// @desc    Get reviews by package
// @route   GET /api/reviews/package/:packageId
export const getReviewsByPackage = asyncHandler(async (req: Request, res: Response) => {
  const reviews = await Review.find({
    package: req.params.packageId,
    isApproved: true,
  })
    .populate('user', 'firstName lastName avatar')
    .sort({ createdAt: -1 });

  res.status(200).json({
    status: 'success',
    results: reviews.length,
    data: reviews,
  });
});

// @desc    Get reviews by destination
// @route   GET /api/reviews/destination/:destId
export const getReviewsByDestination = asyncHandler(async (req: Request, res: Response) => {
  const reviews = await Review.find({
    destination: req.params.destId,
    isApproved: true,
  })
    .populate('user', 'firstName lastName avatar')
    .populate('package', 'name')
    .sort({ createdAt: -1 });

  res.status(200).json({
    status: 'success',
    results: reviews.length,
    data: reviews,
  });
});

// @desc    Create a review
// @route   POST /api/reviews
export const createReview = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!._id;
  const { package: packageId } = req.body;

  // Check if user already reviewed this package
  const existingReview = await Review.findOne({ user: userId, package: packageId });
  if (existingReview) {
    throw new AppError('You have already reviewed this package', 400);
  }

  // Get the package to find its destination
  const pkg = await Package.findById(packageId);
  if (!pkg) {
    throw new AppError('Package not found', 404);
  }

  const review = await Review.create({
    ...req.body,
    user: userId,
    destination: pkg.destination,
  });

  // Recalculate ratings
  await recalculateRatings(packageId, pkg.destination);

  res.status(201).json({
    status: 'success',
    data: review,
  });
});

// @desc    Update a review (own review only)
// @route   PUT /api/reviews/:id
export const updateReview = asyncHandler(async (req: Request, res: Response) => {
  const review = await Review.findById(req.params.id);

  if (!review) {
    throw new AppError('Review not found', 404);
  }

  // Check ownership
  if (review.user.toString() !== req.user!._id.toString()) {
    throw new AppError('You can only update your own reviews', 403);
  }

  const updatedReview = await Review.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });

  // Recalculate ratings
  await recalculateRatings(review.package, review.destination);

  res.status(200).json({
    status: 'success',
    data: updatedReview,
  });
});

// @desc    Delete a review (own or admin)
// @route   DELETE /api/reviews/:id
export const deleteReview = asyncHandler(async (req: Request, res: Response) => {
  const review = await Review.findById(req.params.id);

  if (!review) {
    throw new AppError('Review not found', 404);
  }

  // Check ownership or admin
  const isOwner = review.user.toString() === req.user!._id.toString();
  const isAdmin = req.user!.role === 'admin';

  if (!isOwner && !isAdmin) {
    throw new AppError('You can only delete your own reviews', 403);
  }

  await Review.findByIdAndDelete(req.params.id);

  // Recalculate ratings
  await recalculateRatings(review.package, review.destination);

  res.status(204).json({
    status: 'success',
    data: null,
  });
});

// @desc    Approve a review (admin only)
// @route   PUT /api/reviews/:id/approve
export const approveReview = asyncHandler(async (req: Request, res: Response) => {
  const review = await Review.findByIdAndUpdate(
    req.params.id,
    { isApproved: true },
    { new: true }
  );

  if (!review) {
    throw new AppError('Review not found', 404);
  }

  // Recalculate ratings since approval status changed
  await recalculateRatings(review.package, review.destination);

  res.status(200).json({
    status: 'success',
    data: review,
  });
});
