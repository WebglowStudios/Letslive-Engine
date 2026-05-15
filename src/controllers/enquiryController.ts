import { Request, Response } from 'express';
import Enquiry from '../models/Enquiry.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { AppError } from '../middleware/errorHandler.js';

// @desc    Create an enquiry
// @route   POST /api/enquiries
export const createEnquiry = asyncHandler(async (req: Request, res: Response) => {
  const enquiry = await Enquiry.create(req.body);

  res.status(201).json({
    status: 'success',
    data: enquiry,
  });
});

// @desc    Get all enquiries (admin)
// @route   GET /api/enquiries
export const getAllEnquiries = asyncHandler(async (req: Request, res: Response) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 10;
  const skip = (page - 1) * limit;

  const filter: Record<string, unknown> = {};
  if (req.query.status) filter.status = req.query.status;
  if (req.query.type) filter.type = req.query.type;

  const [enquiries, total] = await Promise.all([
    Enquiry.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
    Enquiry.countDocuments(filter),
  ]);

  res.status(200).json({
    status: 'success',
    results: enquiries.length,
    total,
    page,
    pages: Math.ceil(total / limit),
    data: enquiries,
  });
});

// @desc    Get enquiry by ID (admin)
// @route   GET /api/enquiries/:id
export const getEnquiryById = asyncHandler(async (req: Request, res: Response) => {
  const enquiry = await Enquiry.findById(req.params.id)
    .populate('package', 'name')
    .populate('assignedTo', 'firstName lastName');

  if (!enquiry) {
    throw new AppError('Enquiry not found', 404);
  }

  res.status(200).json({
    status: 'success',
    data: enquiry,
  });
});

// @desc    Update enquiry (admin)
// @route   PUT /api/enquiries/:id
export const updateEnquiry = asyncHandler(async (req: Request, res: Response) => {
  const enquiry = await Enquiry.findById(req.params.id);

  if (!enquiry) {
    throw new AppError('Enquiry not found', 404);
  }

  if (req.body.status) enquiry.status = req.body.status;
  if (req.body.assignedTo) enquiry.assignedTo = req.body.assignedTo;

  // Push a note if provided
  if (req.body.note) {
    enquiry.notes.push({
      text: req.body.note,
      by: req.user!._id,
      date: new Date(),
    });
  }

  await enquiry.save();

  res.status(200).json({
    status: 'success',
    data: enquiry,
  });
});
