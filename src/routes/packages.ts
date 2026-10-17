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
import PackageTemplate from '../models/PackageTemplate.js';

// Duplicate a package
router.post('/:id/duplicate', protect, asyncHandler(async (req: Request, res: Response) => {
  const original = await Package.findById(req.params.id).lean();
  if (!original) {
    res.status(404).json({ status: 'fail', message: 'Package not found' });
    return;
  }

  // Strip MongoDB-managed fields and create a fresh copy
  const { _id, slug, createdAt, updatedAt, __v, ...rest } = original as unknown as Record<string, any>;
  void _id; void createdAt; void updatedAt; void __v;

  const enquiryId = req.body.enquiryId;
  let isCustom = rest.isCustom || Boolean(enquiryId);
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

  // Destination override: only override if non-empty value was provided in req.body
  let destinationOverride = rest.destination;
  let customDestTextOverride = rest.customDestinationText;

  if (req.body.destination !== undefined && req.body.destination !== null && req.body.destination !== '') {
    destinationOverride = req.body.destination;
    if (!req.body.customDestinationText) {
      customDestTextOverride = undefined;
    }
  }
  if (req.body.customDestinationText !== undefined && req.body.customDestinationText !== null && req.body.customDestinationText.trim() !== '') {
    customDestTextOverride = req.body.customDestinationText.trim();
  }

  // Fetch destination document if available (for image / region fallbacks)
  let destDoc: any = null;
  if (destinationOverride) {
    destDoc = await Destination.findById(destinationOverride).lean();
  } else if (customDestTextOverride) {
    destDoc = await Destination.findOne({ name: { $regex: new RegExp(`^${customDestTextOverride.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') } }).lean();
  }

  // 1. Photos & Media Fallbacks
  let heroImage = rest.heroImage;
  if (!heroImage && destDoc?.heroImage) {
    heroImage = destDoc.heroImage;
  }

  let images = Array.isArray(rest.images) && rest.images.length > 0 ? [...rest.images] : [];
  if (images.length === 0 && Array.isArray(destDoc?.images) && destDoc.images.length > 0) {
    images = [...destDoc.images];
  }

  let destinationImages = Array.isArray(rest.destinationImages) && rest.destinationImages.length > 0 ? [...rest.destinationImages] : [];
  if (destinationImages.length === 0 && Array.isArray(destDoc?.images) && destDoc.images.length > 0) {
    destinationImages = [...destDoc.images];
  }

  // Harvest activity images from itinerary if activityImages is empty
  let activityImages = Array.isArray(rest.activityImages) && rest.activityImages.length > 0 ? [...rest.activityImages] : [];
  if (activityImages.length === 0 && Array.isArray(rest.itinerary)) {
    const harvested: string[] = [];
    rest.itinerary.forEach((d: any) => {
      if (Array.isArray(d?.activities)) {
        d.activities.forEach((a: any) => {
          if (a?.image && typeof a.image === 'string') harvested.push(a.image);
          if (Array.isArray(a?.images)) harvested.push(...a.images.filter(Boolean));
        });
      }
    });
    if (harvested.length > 0) {
      activityImages = Array.from(new Set(harvested));
    }
  }

  let stayImages = Array.isArray(rest.stayImages) && rest.stayImages.length > 0 ? [...rest.stayImages] : [];

  // 2. Policies & Payment Terms Fallbacks
  let paymentPolicy = Array.isArray(rest.paymentPolicy) && rest.paymentPolicy.length > 0 ? [...rest.paymentPolicy] : [];
  let cancellationPolicy = Array.isArray(rest.cancellationPolicy) && rest.cancellationPolicy.length > 0 ? [...rest.cancellationPolicy] : [];
  let flightCancellationPolicy = Array.isArray(rest.flightCancellationPolicy) && rest.flightCancellationPolicy.length > 0 ? [...rest.flightCancellationPolicy] : [];

  const isInternational = Boolean(rest.isInternational || destDoc?.region === 'international' || destDoc?.country?.toLowerCase() !== 'india');
  const isGroup = Boolean(rest.isGroupTour);

  if (paymentPolicy.length === 0) {
    let query: any = { category: 'paymentPolicy' };
    if (isGroup) {
      query.name = { $regex: /group/i };
    } else if (isInternational) {
      query.name = { $regex: /international/i };
    } else {
      query.name = { $regex: /domestic/i };
    }
    const tpl = await PackageTemplate.findOne(query).lean();
    if (tpl?.items && tpl.items.length > 0) {
      paymentPolicy = [...tpl.items];
    }
  }

  if (cancellationPolicy.length === 0) {
    let query: any = { category: 'cancellationPolicy' };
    if (isInternational) {
      query.name = { $regex: /international/i };
    } else {
      query.name = { $regex: /domestic/i };
    }
    const tpl = await PackageTemplate.findOne(query).lean();
    if (tpl?.items && tpl.items.length > 0) {
      cancellationPolicy = [...tpl.items];
    }
  }

  if (flightCancellationPolicy.length === 0 && (rest.flightsIncluded || (Array.isArray(rest.flights) && rest.flights.length > 0))) {
    const tpl = await PackageTemplate.findOne({ category: 'flightCancellationPolicy' }).lean();
    if (tpl?.items && tpl.items.length > 0) {
      flightCancellationPolicy = [...tpl.items];
    }
  }

  // 3. Payment Configuration
  let paymentConfig = rest.paymentConfig;
  if (!paymentConfig || typeof paymentConfig !== 'object' || !paymentConfig.mode) {
    paymentConfig = {
      mode: isGroup ? 'partial' : (rest.paymentConfig?.mode || 'partial'),
      depositType: isGroup ? 'fixed' : (rest.paymentConfig?.depositType || 'percent'),
      depositValue: isGroup ? 4000 : (rest.paymentConfig?.depositValue || 25),
      depositLabel: isGroup ? 'Group Tour Advance' : (rest.paymentConfig?.depositLabel || 'Advance Booking Amount'),
      balanceDueDays: rest.paymentConfig?.balanceDueDays || (isGroup ? 15 : 10),
    };
  }

  // 4. Strip subdocument _id fields so MongoDB generates fresh, unique IDs
  const cleanItinerary = Array.isArray(rest.itinerary)
    ? rest.itinerary.map((d: any) => {
        const { _id, ...dayRest } = d || {};
        void _id;
        if (Array.isArray(dayRest.activities)) {
          dayRest.activities = dayRest.activities.map((a: any) => {
            if (a && typeof a === 'object') {
              const { _id, ...actRest } = a;
              void _id;
              return actRest;
            }
            return a;
          });
        }
        if (Array.isArray(dayRest.recommendations)) {
          dayRest.recommendations = dayRest.recommendations.map((r: any) => {
            if (r && typeof r === 'object') {
              const { _id, ...recRest } = r;
              void _id;
              return recRest;
            }
            return r;
          });
        }
        return dayRest;
      })
    : [];

  const cleanStays = Array.isArray(rest.stays)
    ? rest.stays.map((s: any) => {
        const { _id, ...sRest } = s || {};
        void _id;
        return sRest;
      })
    : [];

  const cleanTransfers = Array.isArray(rest.transfers)
    ? rest.transfers.map((t: any) => {
        const { _id, ...tRest } = t || {};
        void _id;
        if (Array.isArray(tRest.legs)) {
          tRest.legs = tRest.legs.map((l: any) => {
            const { _id, ...lRest } = l || {};
            void _id;
            return lRest;
          });
        }
        return tRest;
      })
    : [];

  const cleanDepartures = Array.isArray(rest.departures)
    ? rest.departures.map((dep: any) => {
        const { _id, ...depRest } = dep || {};
        void _id;
        return depRest;
      })
    : [];

  const cleanFlights = Array.isArray(rest.flights)
    ? rest.flights.map((f: any) => {
        const { _id, ...fRest } = f || {};
        void _id;
        return fRest;
      })
    : [];

  const copy: any = await Package.create({
    ...rest,
    name: copyName,
    slug: uniqueSlug,
    destination: destinationOverride as any,
    customDestinationText: customDestTextOverride as any,
    heroImage,
    images,
    destinationImages,
    stayImages,
    activityImages,
    paymentPolicy,
    cancellationPolicy,
    flightCancellationPolicy,
    paymentConfig,
    itinerary: cleanItinerary,
    stays: cleanStays,
    transfers: cleanTransfers,
    departures: cleanDepartures,
    flights: cleanFlights,
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
