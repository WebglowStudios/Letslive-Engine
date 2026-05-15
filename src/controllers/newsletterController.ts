import { Request, Response } from 'express';
import Newsletter from '../models/Newsletter.js';
import { asyncHandler } from '../middleware/asyncHandler.js';

// @desc    Subscribe to newsletter
// @route   POST /api/newsletter/subscribe
export const subscribe = asyncHandler(async (req: Request, res: Response) => {
  const { email, name, favouriteDestination } = req.body;

  const existing = await Newsletter.findOne({ email: email.toLowerCase() });

  if (existing) {
    if (existing.isSubscribed) {
      res.status(200).json({
        status: 'success',
        message: 'Already subscribed',
      });
      return;
    }

    // Resubscribe
    existing.isSubscribed = true;
    existing.subscribedAt = new Date();
    existing.unsubscribedAt = undefined;
    await existing.save();

    res.status(201).json({
      status: 'success',
      message: 'Successfully resubscribed',
      data: existing,
    });
    return;
  }

  const subscriber = await Newsletter.create({
    email,
    name,
    favouriteDestination,
  });

  res.status(201).json({
    status: 'success',
    message: 'Successfully subscribed',
    data: subscriber,
  });
});

// @desc    Unsubscribe from newsletter
// @route   POST /api/newsletter/unsubscribe
export const unsubscribe = asyncHandler(async (req: Request, res: Response) => {
  const { email } = req.body;

  const subscriber = await Newsletter.findOne({ email: email.toLowerCase() });

  if (subscriber) {
    subscriber.isSubscribed = false;
    subscriber.unsubscribedAt = new Date();
    await subscriber.save();
  }

  // Always return success (don't reveal if email exists)
  res.status(200).json({
    status: 'success',
    message: 'Successfully unsubscribed',
  });
});

// @desc    Get all subscribers (admin)
// @route   GET /api/newsletter/subscribers
export const getSubscribers = asyncHandler(async (req: Request, res: Response) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 20;
  const skip = (page - 1) * limit;

  const [subscribers, total] = await Promise.all([
    Newsletter.find({ isSubscribed: true }).sort({ subscribedAt: -1 }).skip(skip).limit(limit),
    Newsletter.countDocuments({ isSubscribed: true }),
  ]);

  res.status(200).json({
    status: 'success',
    results: subscribers.length,
    total,
    page,
    pages: Math.ceil(total / limit),
    data: subscribers,
  });
});
