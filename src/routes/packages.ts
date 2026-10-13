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

import slugify from 'slugify';
import Destination from '../models/Destination.js';

// Duplicate a package
router.post('/:id/duplicate', protect, asyncHandler(async (req: Request, res: Response) => {
  const original = await Package.findById(req.params.id).lean();
  if (!original) {
    res.status(404).json({ status: 'fail', message: 'Package not found' });
    return;
  }

  // Strip MongoDB-managed fields and create a fresh copy
  const { _id, slug, createdAt, updatedAt, __v, ...rest } = original as unknown as Record<string, unknown>;
  void _id; void createdAt; void updatedAt; void __v;

  const enquiryId = req.body.enquiryId;
  let isCustom = (rest as any).isCustom || Boolean(enquiryId);
  let customerData: Record<string, unknown> = {};
  let targetEnquiry: any = null;

  if (enquiryId) {
    targetEnquiry = await Enquiry.findById(enquiryId);
    if (targetEnquiry) {
      isCustom = true;
      customerData = {
        enquiryId,
        clientName: `${targetEnquiry.firstName} ${targetEnquiry.lastName || ''}`.trim(),
        clientEmail: targetEnquiry.email,
        clientPhone: targetEnquiry.phone,
      };
    }
  }

  // Resolve custom name
  let copyName = req.body.name && req.body.name.trim() ? req.body.name.trim() : '';
  if (!copyName) {
    if (targetEnquiry && targetEnquiry.packageName) {
      copyName = targetEnquiry.packageName;
    } else {
      copyName = `${rest.name} -- copy`;
    }
  }

  // Generate unique slug based on the new name, not the old slug
  const baseSlugFn = ((slugify as any).default || slugify);
  const baseSlug = baseSlugFn(copyName, { lower: true, strict: true }) || 'itinerary';
  const randomSuffix = Math.random().toString(36).slice(2, 7);
  const uniqueSlug = `${baseSlug}-${Date.now().toString(36)}-${randomSuffix}`;

  // Destination override:
  let destinationOverride = rest.destination;
  let customDestTextOverride = rest.customDestinationText;

  if (req.body.destination !== undefined) {
    destinationOverride = req.body.destination ? req.body.destination : undefined;
  }
  if (req.body.customDestinationText !== undefined) {
    customDestTextOverride = req.body.customDestinationText ? req.body.customDestinationText.trim() : undefined;
  }

  const copy: any = await Package.create({
    ...rest,
    name: copyName,
    slug: uniqueSlug,
    destination: destinationOverride as any,
    customDestinationText: customDestTextOverride as any,
    isFeatured: false,
    approvalStatus: 'approved',
    isActive: true,
    rating: 0,
    reviewCount: 0,
    createdBy: req.user!._id,
    isCustom,
    ...customerData,
  } as any);

  if (enquiryId && isCustom && targetEnquiry) {
    const creatorName = req.user ? `${req.user.firstName} ${req.user.lastName || ''}`.trim() : 'Staff';
    const enquiryUpdate: Record<string, any> = {
      package: copy._id,
      packageName: copy.name,
      $push: {
        timeline: {
          type: 'itinerary_linked',
          title: `Custom itinerary created: ${copy.name}`,
          description: `Custom proposal created by ${creatorName}${copy.price ? ` • ₹${copy.price.toLocaleString('en-IN')}` : ''}`,
          by: req.user!._id,
          byName: creatorName,
          date: new Date(),
          meta: { packageId: copy._id, slug: copy.slug, name: copy.name, price: copy.price },
        },
      },
    };

    // If destination was set on the new copy and enquiry had no destination, set it on enquiry
    if (!targetEnquiry.destination) {
      if (customDestTextOverride) {
        enquiryUpdate.destination = customDestTextOverride;
      } else if (destinationOverride) {
        const destDoc = await Destination.findById(destinationOverride).select('name');
        if (destDoc?.name) {
          enquiryUpdate.destination = destDoc.name;
        }
      }
    }

    await Enquiry.findByIdAndUpdate(enquiryId, enquiryUpdate);
  }

  res.status(201).json({ status: 'success', data: copy });
}));

export default router;
