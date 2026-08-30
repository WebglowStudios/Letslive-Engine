import { Router } from 'express';
import {
  getPackages,
  getFeaturedPackages,
  getPackageBySlug,
  getPackagesByDestination,
  createPackage,
  updatePackage,
  deletePackage,
  delinkPackage,
} from '../controllers/packageController.js';
import { protect, requirePermission } from '../middleware/auth.js';
import Package from '../models/Package.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import Enquiry from '../models/Enquiry.js';
import { Request, Response } from 'express';

const router = Router();

// Custom itineraries (staff+)
router.get('/custom', protect, requirePermission('packages.view'), asyncHandler(async (req: Request, res: Response) => {
  const filter: Record<string, unknown> = { isCustom: true };
  // Staff only sees their own, admin/manager sees all
  if (['staff', 'sales-staff', 'ops-staff'].includes(req.user!.role)) {
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
router.post('/', protect, requirePermission('packages.create'), createPackage);
router.put('/:id', protect, requirePermission('packages.edit'), updatePackage);
router.delete('/:id', protect, requirePermission('packages.delete'), deletePackage);
router.post('/:id/delink', protect, requirePermission('packages.edit'), delinkPackage);

// Duplicate a package
router.post('/:id/duplicate', protect, requirePermission('packages.create'), asyncHandler(async (req: Request, res: Response) => {
  const original = await Package.findById(req.params.id).lean();
  if (!original) {
    res.status(404).json({ status: 'fail', message: 'Package not found' });
    return;
  }

  // Strip MongoDB-managed fields and create a fresh copy
  const { _id, slug, createdAt, updatedAt, __v, ...rest } = original as unknown as Record<string, unknown>;
  void _id; void createdAt; void updatedAt; void __v;

  // Build a unique name by appending a timestamp so repeated duplicates never clash
  const copyName = `${rest.name} -- copy`;
  const uniqueSlug = `${slug}-copy-${Date.now()}`;

  let customerData = {};
  let isCustom = (rest as any).isCustom || false;
  const enquiryId = req.body.enquiryId;

  if (enquiryId) {
    const enquiry = await Enquiry.findById(enquiryId);
    if (enquiry) {
      isCustom = true;
      customerData = {
        enquiryId,
        clientName: `${enquiry.firstName} ${enquiry.lastName || ''}`.trim(),
        clientEmail: enquiry.email,
        clientPhone: enquiry.phone,
      };
    }
  }

  const copy = await Package.create({
    ...rest,
    name: copyName,
    slug: uniqueSlug,
    isFeatured: false,
    approvalStatus: 'pending',
    rating: 0,
    reviewCount: 0,
    createdBy: req.user!._id,
    isCustom,
    ...customerData,
  });

  if (enquiryId && isCustom) {
    await Enquiry.findByIdAndUpdate(enquiryId, {
      package: copy._id,
      packageName: copy.name,
    });
  }

  res.status(201).json({ status: 'success', data: copy });
}));

export default router;
