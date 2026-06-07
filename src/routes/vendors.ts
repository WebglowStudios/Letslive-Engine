import { Router, Request, Response } from 'express';
import { protect, staffOnly } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { AppError } from '../middleware/errorHandler.js';
import Vendor from '../models/Vendor.js';

const router = Router();
router.use(protect, staffOnly);

// GET all vendors (with optional type filter)
router.get('/', asyncHandler(async (req: Request, res: Response) => {
  const filter: Record<string, unknown> = { isActive: true };
  if (req.query.type) filter.type = req.query.type;
  if (req.query.search) {
    filter.name = new RegExp(req.query.search as string, 'i');
  }
  const vendors = await Vendor.find(filter).sort({ name: 1 });
  res.status(200).json({ status: 'success', data: vendors });
}));

// GET single vendor
router.get('/:id', asyncHandler(async (req: Request, res: Response) => {
  const vendor = await Vendor.findById(req.params.id);
  if (!vendor) throw new AppError('Vendor not found', 404);
  res.status(200).json({ status: 'success', data: vendor });
}));

// CREATE vendor
router.post('/', asyncHandler(async (req: Request, res: Response) => {
  const vendor = await Vendor.create(req.body);
  res.status(201).json({ status: 'success', data: vendor });
}));

// UPDATE vendor
router.put('/:id', asyncHandler(async (req: Request, res: Response) => {
  const vendor = await Vendor.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
  if (!vendor) throw new AppError('Vendor not found', 404);
  res.status(200).json({ status: 'success', data: vendor });
}));

// DELETE vendor (soft delete)
router.delete('/:id', asyncHandler(async (req: Request, res: Response) => {
  await Vendor.findByIdAndUpdate(req.params.id, { isActive: false });
  res.status(204).json({ status: 'success', data: null });
}));

export default router;
