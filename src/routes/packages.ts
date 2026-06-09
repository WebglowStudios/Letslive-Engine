import { Router } from 'express';
import {
  getPackages,
  getFeaturedPackages,
  getPackageBySlug,
  getPackagesByDestination,
  createPackage,
  updatePackage,
  deletePackage,
} from '../controllers/packageController.js';
import { protect, staffOnly, adminOnly } from '../middleware/auth.js';
import Package from '../models/Package.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { Request, Response } from 'express';

const router = Router();

// Custom itineraries (staff+)
router.get('/custom', protect, staffOnly, asyncHandler(async (req: Request, res: Response) => {
  const filter: Record<string, unknown> = { isCustom: true };
  // Staff only sees their own, admin/manager sees all
  if (req.user!.role === 'staff') {
    filter.createdBy = req.user!._id;
  }
  const itineraries = await Package.find(filter)
    .populate('destination', 'name slug')
    .populate('createdBy', 'firstName lastName')
    .populate('enquiryId', 'firstName email')
    .sort({ createdAt: -1 });
  res.status(200).json({ status: 'success', results: itineraries.length, data: itineraries });
}));

router.get('/', getPackages);
router.get('/featured', getFeaturedPackages);
router.get('/destination/:destSlug', getPackagesByDestination);
router.get('/:slug', getPackageBySlug);
router.post('/', protect, staffOnly, createPackage);
router.put('/:id', protect, staffOnly, updatePackage);
router.delete('/:id', protect, adminOnly, deletePackage);

// Duplicate a package
router.post('/:id/duplicate', protect, staffOnly, asyncHandler(async (req: Request, res: Response) => {
  const original = await Package.findById(req.params.id).lean();
  if (!original) {
    res.status(404).json({ status: 'fail', message: 'Package not found' });
    return;
  }

  // Strip MongoDB-managed fields and create a fresh copy
  const { _id, slug, createdAt, updatedAt, __v, ...rest } = original as unknown as Record<string, unknown>;
  void _id; void slug; void createdAt; void updatedAt; void __v;

  const copy = await Package.create({
    ...rest,
    name: `${rest.name} -- copy`,
    // slug is auto-generated from name in pre-validate hook
    isFeatured: false,
    approvalStatus: 'pending',
    rating: 0,
    reviewCount: 0,
    createdBy: req.user!._id,
  });

  res.status(201).json({ status: 'success', data: copy });
}));

export default router;
