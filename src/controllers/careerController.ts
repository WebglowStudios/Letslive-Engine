import { Request, Response } from 'express';
import Career from '../models/Career.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { AppError } from '../middleware/errorHandler.js';

// @desc    Get active careers (public)
// @route   GET /api/careers
export const getCareers = asyncHandler(async (req: Request, res: Response) => {
  const filter: Record<string, unknown> = { isActive: true };
  if (req.query.department) filter.department = req.query.department;

  const careers = await Career.find(filter)
    .select('-applications')
    .sort({ createdAt: -1 });

  res.status(200).json({
    status: 'success',
    results: careers.length,
    data: careers,
  });
});

// @desc    Get career by slug (public)
// @route   GET /api/careers/:slug
export const getCareerBySlug = asyncHandler(async (req: Request, res: Response) => {
  const param = req.params.slug as string;

  // Try by slug first, then by _id
  let career = await Career.findOne({ slug: param }).select('-applications');
  if (!career && param.match(/^[0-9a-fA-F]{24}$/)) {
    career = await Career.findById(param).select('-applications');
  }

  if (!career) {
    throw new AppError('Career not found', 404);
  }

  res.status(200).json({
    status: 'success',
    data: career,
  });
});

// @desc    Apply to a career (public)
// @route   POST /api/careers/:id/apply
export const applyToCareer = asyncHandler(async (req: Request, res: Response) => {
  const career = await Career.findById(req.params.id);

  if (!career) {
    throw new AppError('Career not found', 404);
  }

  if (!career.isActive) {
    throw new AppError('This position is no longer accepting applications', 400);
  }

  const application = {
    name: req.body.name,
    email: req.body.email,
    phone: req.body.phone,
    resume: req.body.resume,
    coverLetter: req.body.coverLetter,
    status: 'new' as const,
    appliedAt: new Date(),
  };

  career.applications.push(application);
  await career.save();

  res.status(201).json({
    status: 'success',
    message: 'Application submitted successfully',
  });
});

// @desc    Create a career (admin)
// @route   POST /api/careers
export const createCareer = asyncHandler(async (req: Request, res: Response) => {
  const career = await Career.create(req.body);

  res.status(201).json({
    status: 'success',
    data: career,
  });
});

// @desc    Update a career (admin)
// @route   PUT /api/careers/:id
export const updateCareer = asyncHandler(async (req: Request, res: Response) => {
  const career = await Career.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });

  if (!career) {
    throw new AppError('Career not found', 404);
  }

  res.status(200).json({
    status: 'success',
    data: career,
  });
});

// @desc    Delete a career (admin)
// @route   DELETE /api/careers/:id
export const deleteCareer = asyncHandler(async (req: Request, res: Response) => {
  const career = await Career.findByIdAndDelete(req.params.id);

  if (!career) {
    throw new AppError('Career not found', 404);
  }

  res.status(204).json({
    status: 'success',
    data: null,
  });
});

// @desc    Get career applications (admin)
// @route   GET /api/careers/:id/applications
export const getCareerApplications = asyncHandler(async (req: Request, res: Response) => {
  const career = await Career.findById(req.params.id).select('title applications');

  if (!career) {
    throw new AppError('Career not found', 404);
  }

  res.status(200).json({
    status: 'success',
    results: career.applications.length,
    data: career.applications,
  });
});
