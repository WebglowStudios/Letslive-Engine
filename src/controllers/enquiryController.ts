import { Request, Response } from 'express';
import mongoose from 'mongoose';
import Enquiry from '../models/Enquiry.js';
import User from '../models/User.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { AppError } from '../middleware/errorHandler.js';
import {
  sendEnquiryReceived,
  sendCallbackRequested,
  sendAdminNewEnquiry,
  sendStaffEnquiryAssigned,
  sendDNP3Alert,
  sendDNP6Alert,
  sendBookingLink,
} from '../services/emailService.js';
import Package from '../models/Package.js';

import { logActivity } from '../utils/logActivity.js';
import ActivityLog from '../models/ActivityLog.js';

// Auto-determine priority based on enquiry type
function determinePriority(type: string, travelDate?: Date): string {
  if (type === 'group-quote' || type === 'callback') return 'high';
  if (travelDate) {
    const daysUntilTravel = Math.ceil((new Date(travelDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    if (daysUntilTravel <= 7) return 'urgent';
    if (daysUntilTravel <= 30) return 'high';
  }
  if (type === 'booking') return 'medium';
  return 'low';
}

// @desc    Create an enquiry (public — lands as 'new', admin assigns manually)
// @route   POST /api/enquiries
export const createEnquiry = asyncHandler(async (req: Request, res: Response) => {
  // Auto-determine priority — no auto-assignment
  const priority = determinePriority(req.body.type || 'general', req.body.travelDate);

  // Auto-fetch destination & package details if package or packageName is provided
  let destination = req.body.destination;
  let packageName = req.body.packageName;
  let packageId = req.body.package;
  let pkgObj: any = null;

  if (packageId) {
    pkgObj = await Package.findById(packageId).populate('destination', 'name');
  } else if (packageName) {
    pkgObj = await Package.findOne({ name: packageName }).populate('destination', 'name');
  }

  if (pkgObj) {
    if (!packageName) packageName = pkgObj.name;
    if (!packageId) packageId = pkgObj._id;
    if (!destination) {
      destination = pkgObj.destination?.name || pkgObj.customDestinationText || undefined;
    }
  }

  // Resolve linked user:
  // 1. If optionalProtect set req.user (logged-in user), use them directly.
  // 2. Otherwise fall back to email lookup (anonymous/guest submitting with an existing email).
  let linkedUserId: mongoose.Types.ObjectId | undefined = undefined;
  if (req.user) {
    linkedUserId = req.user._id;
  } else {
    const existingUser = await User.findOne({ email: req.body.email?.toLowerCase().trim() });
    if (existingUser) {
      linkedUserId = existingUser._id;
    }
  }

  // Build granular initial timeline events for user acquisition
  const initialTimeline: any[] = [
    {
      type: 'acquisition',
      title: `Enquiry received via ${req.body.source || 'website'}${req.body.channel ? ` (Channel: ${req.body.channel})` : ''}`,
      description: `Inbound ${req.body.type || 'general'} inquiry submitted`,
      date: new Date(),
      meta: { source: req.body.source || 'website', channel: req.body.channel, type: req.body.type || 'general' },
    },
  ];

  if (destination || req.body.travelDate || req.body.travellerCount || req.body.adultCount || req.body.childCount || req.body.infantCount || req.body.budget) {
    const totalPax = req.body.travellerCount ?? ((Number(req.body.adultCount) || 0) + (Number(req.body.childCount) || 0) + (Number(req.body.infantCount) || 0) || undefined);
    const paxParts: string[] = [];
    if (req.body.adultCount) paxParts.push(`${req.body.adultCount} Adult${req.body.adultCount === 1 ? '' : 's'}`);
    if (req.body.childCount) paxParts.push(`${req.body.childCount} Child${req.body.childCount === 1 ? '' : 'ren'}`);
    if (req.body.infantCount) paxParts.push(`${req.body.infantCount} Infant${req.body.infantCount === 1 ? '' : 's'}`);
    const paxBreakdown = paxParts.length > 0 ? ` (${paxParts.join(', ')})` : '';

    const details = [
      destination ? `Destination: ${destination}` : null,
      totalPax ? `Travellers: ${totalPax} pax${paxBreakdown}` : null,
      req.body.budget ? `Budget: ₹${Number(req.body.budget).toLocaleString('en-IN')}` : null,
      req.body.travelDate ? `Travel Date: ${new Date(req.body.travelDate).toLocaleDateString('en-IN')}` : null,
    ].filter(Boolean).join(' • ');

    initialTimeline.push({
      type: 'requirements',
      title: 'Trip requirements captured',
      description: details,
      date: new Date(Date.now() + 100),
      meta: {
        destination,
        travelDate: req.body.travelDate,
        travellerCount: totalPax,
        adultCount: req.body.adultCount,
        childCount: req.body.childCount,
        infantCount: req.body.infantCount,
        budget: req.body.budget,
      },
    });
  }

  if (packageName) {
    initialTimeline.push({
      type: 'system',
      title: `Package of interest: ${packageName}`,
      date: new Date(Date.now() + 200),
      meta: { packageName, package: packageId },
    });
  }

  if (req.body.message) {
    initialTimeline.push({
      type: 'message',
      title: 'Initial customer query message',
      description: req.body.message,
      date: new Date(Date.now() + 300),
    });
  }

  const enquiry = await Enquiry.create({
    ...req.body,
    destination: destination || undefined,
    packageName: packageName || undefined,
    package: packageId || undefined,
    user: linkedUserId,
    assignedTo: undefined,   // always unassigned — admin will assign manually
    status: 'new',
    priority,
    timeline: initialTimeline,
  });

  // Send emails (fire-and-forget)
  const customerEmail = enquiry.email;
  const customerName = enquiry.firstName;
  const type = req.body.type || 'general';

  // Customer confirmation
  if (type === 'callback' && req.body.phone) {
    sendCallbackRequested(customerEmail, customerName, req.body.phone).catch(console.error);
  } else {
    sendEnquiryReceived(customerEmail, customerName).catch(console.error);
  }

  // Admin notification — always fires so admin can see and assign
  sendAdminNewEnquiry(customerName, customerEmail, type, req.body.packageName).catch(console.error);

  // Log public enquiry submission (no req.user — use the enquiry itself as context)
  ActivityLog.create({
    user: enquiry._id,                                         // use enquiry._id as a stand-in
    userName: `${enquiry.firstName} ${enquiry.lastName || ''}`.trim(),
    userRole: 'user',
    action: 'create',
    entity: 'enquiry',
    entityId: String(enquiry._id),
    entityName: `${enquiry.firstName} ${enquiry.lastName || ''}`.trim(),
    description: `New enquiry from ${enquiry.firstName} (${enquiry.email}) — type: ${enquiry.type}${enquiry.packageName ? `, package: ${enquiry.packageName}` : ''}`,
    meta: { type: enquiry.type, source: enquiry.source, packageName: enquiry.packageName, email: enquiry.email },
  }).catch(console.error);

  res.status(201).json({
    status: 'success',
    data: enquiry,
  });
});


// @desc    Manually create an enquiry (staff+ — for walk-in / phone / WhatsApp leads)
// @route   POST /api/enquiries/manual
export const manualCreateEnquiry = asyncHandler(async (req: Request, res: Response) => {
  const {
    firstName, lastName, email, phone, type, message,
    packageName, destination, travelDate, travellerCount, budget,
    adultCount, childCount, infantCount,
    tags, channel, assignedTo, priority: manualPriority, departureId,
  } = req.body;

  if (!firstName || !email || !phone) {
    throw new AppError('firstName, email and phone are required', 400);
  }

  // Allow manual assignedTo — if not provided, auto-assign to the logged-in staff member creating it
  const assignedToId = assignedTo || req.user?._id || undefined;
  const priority = manualPriority || determinePriority(type || 'general', travelDate);

  let resolvedDestination = destination;
  let resolvedPackageName = packageName;
  let packageId = req.body.package;
  let pkgObj: any = null;

  if (packageId) {
    pkgObj = await Package.findById(packageId).populate('destination', 'name');
  } else if (resolvedPackageName) {
    pkgObj = await Package.findOne({ name: resolvedPackageName }).populate('destination', 'name');
  }

  if (pkgObj) {
    if (!resolvedPackageName) resolvedPackageName = pkgObj.name;
    if (!packageId) packageId = pkgObj._id;
    if (!resolvedDestination) {
      resolvedDestination = pkgObj.destination?.name || pkgObj.customDestinationText || undefined;
    }
  }

  const existingUser = await User.findOne({ email: email?.toLowerCase().trim() });

  const creatorName = req.user ? `${req.user.firstName} ${req.user.lastName || ''}`.trim() : 'Staff';
  const initialTimeline: any[] = [
    {
      type: 'acquisition',
      title: `Manual lead created via ${channel || 'phone'}`,
      description: `Lead ingested and recorded by ${creatorName}`,
      by: req.user?._id,
      byName: creatorName,
      date: new Date(),
      meta: { channel, source: (['whatsapp', 'website', 'instagram', 'google', 'referral', 'walk-in', 'other'].includes(channel)) ? channel : 'phone' },
    },
  ];

  const totalPax = travellerCount ?? ((Number(adultCount) || 0) + (Number(childCount) || 0) + (Number(infantCount) || 0) || undefined);
  const paxParts: string[] = [];
  if (adultCount) paxParts.push(`${adultCount} Adult${Number(adultCount) === 1 ? '' : 's'}`);
  if (childCount) paxParts.push(`${childCount} Child${Number(childCount) === 1 ? '' : 'ren'}`);
  if (infantCount) paxParts.push(`${infantCount} Infant${Number(infantCount) === 1 ? '' : 's'}`);
  const paxBreakdown = paxParts.length > 0 ? ` (${paxParts.join(', ')})` : '';

  if (resolvedDestination || travelDate || totalPax || budget) {
    const details = [
      resolvedDestination ? `Destination: ${resolvedDestination}` : null,
      totalPax ? `Travellers: ${totalPax} pax${paxBreakdown}` : null,
      budget ? `Budget: ₹${Number(budget).toLocaleString('en-IN')}` : null,
      travelDate ? `Travel Date: ${new Date(travelDate).toLocaleDateString('en-IN')}` : null,
    ].filter(Boolean).join(' • ');

    initialTimeline.push({
      type: 'requirements',
      title: 'Trip requirements recorded',
      description: details,
      by: req.user?._id,
      byName: creatorName,
      date: new Date(Date.now() + 100),
      meta: { destination: resolvedDestination, travelDate, travellerCount: totalPax, adultCount, childCount, infantCount, budget },
    });
  }

  if (resolvedPackageName) {
    initialTimeline.push({
      type: 'system',
      title: `Package of interest: ${resolvedPackageName}`,
      by: req.user?._id,
      byName: creatorName,
      date: new Date(Date.now() + 200),
    });
  }

  if (message) {
    initialTimeline.push({
      type: 'message',
      title: 'Lead notes / customer query',
      description: message,
      by: req.user?._id,
      byName: creatorName,
      date: new Date(Date.now() + 300),
    });
  }

  if (assignedToId) {
    const staffMember = await User.findById(assignedToId);
    const assignedStaffName = staffMember ? `${staffMember.firstName} ${staffMember.lastName || ''}`.trim() : 'Staff';
    initialTimeline.push({
      type: 'assignment',
      title: `Assigned to ${assignedStaffName}`,
      description: `Assigned upon creation by ${creatorName}`,
      by: req.user?._id,
      byName: creatorName,
      date: new Date(Date.now() + 400),
    });
  }

  const enquiry = await Enquiry.create({
    firstName, lastName, email, phone,
    type: type || 'general',
    message,
    packageName: resolvedPackageName || undefined,
    package: packageId || undefined,
    destination: resolvedDestination || undefined,
    travelDate,
    travellerCount: totalPax,
    adultCount: adultCount ? Number(adultCount) : undefined,
    childCount: childCount ? Number(childCount) : undefined,
    infantCount: infantCount ? Number(infantCount) : undefined,
    budget,
    departureId,
    tags: tags || [],
    channel: channel || 'phone',
    source: (['whatsapp', 'website', 'instagram', 'google', 'referral', 'walk-in', 'other'].includes(channel))
      ? channel
      : 'phone',
    assignedTo: assignedToId || undefined,
    user: existingUser ? existingUser._id : undefined,
    status: assignedToId ? 'assigned' : 'new',
    priority,
    timeline: initialTimeline,
  });

  await logActivity({
    req,
    action: 'create',
    entity: 'enquiry',
    entityId: String(enquiry._id),
    entityName: `${firstName} ${lastName || ''}`.trim(),
    description: `Manual lead created for ${firstName} via ${channel || 'phone'}`,
    meta: { channel, source: enquiry.source },
  });

  // Notify admin about the new manual lead
  sendAdminNewEnquiry(
    `${firstName} ${lastName || ''}`.trim(),
    email,
    type || 'general',
    packageName,
  ).catch(console.error);

  // If assigned at creation time, notify the staff member
  if (assignedToId) {
    const staffMember = await User.findById(assignedToId);
    if (staffMember) {
      sendStaffEnquiryAssigned(
        staffMember.email,
        staffMember.firstName,
        `${firstName} ${lastName || ''}`.trim(),
        type || 'general',
        packageName,
      ).catch(console.error);
    }
  }

  res.status(201).json({ status: 'success', data: enquiry });
});

// @desc    Get enquiries assigned to me (staff)
// @route   GET /api/enquiries/mine
export const getMyEnquiries = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!._id;
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 20;
  const skip = (page - 1) * limit;

  const filter: Record<string, unknown> = { assignedTo: userId };
  if (req.query.status && req.query.status !== 'all') {
    const rawStatuses = String(req.query.status).split(',').map((s) => s.trim()).filter(Boolean);
    if (rawStatuses.length > 1) {
      const expanded: string[] = [];
      for (const st of rawStatuses) {
        if (st === 'new' || st === 'begin') expanded.push('new', 'begin');
        else expanded.push(st);
      }
      filter.status = { $in: Array.from(new Set(expanded)) };
    } else if (rawStatuses[0] === 'new' || rawStatuses[0] === 'begin') {
      filter.status = { $in: ['new', 'begin'] };
    } else if (rawStatuses[0]) {
      filter.status = rawStatuses[0];
    }
  }

  if (req.query.leadAge && req.query.leadAge !== 'all') {
    const now = new Date();
    switch (req.query.leadAge) {
      case 'today':
        filter.createdAt = { $gte: new Date(now.getTime() - 24 * 60 * 60 * 1000) };
        break;
      case 'new':
      case '3days':
        filter.createdAt = { $gte: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000) };
        break;
      case '7days':
        filter.createdAt = { $gte: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) };
        break;
      case 'old':
      case 'older7days':
        filter.createdAt = { $lte: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) };
        break;
      case 'older14days':
        filter.createdAt = { $lte: new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000) };
        break;
      case 'older30days':
        filter.createdAt = { $lte: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) };
        break;
    }
  }

  if (req.query.channel && req.query.channel !== 'all') {
    const rawChannels = String(req.query.channel).split(',').map((c) => c.trim()).filter(Boolean);
    if (rawChannels.length > 1) {
      filter.channel = { $in: rawChannels };
    } else if (rawChannels.length === 1) {
      filter.channel = rawChannels[0];
    }
  }

  if (req.query.dnp) {
    const dnpVal = String(req.query.dnp).toLowerCase().trim();
    if (dnpVal === 'any' || dnpVal === 'all' || dnpVal === 'true') {
      filter.dnpCount = { $gt: 0 };
    } else if (dnpVal === '6+' || dnpVal === '6plus') {
      filter.dnpCount = { $gte: 6 };
    } else if (dnpVal === '0' || dnpVal === 'none') {
      filter.dnpCount = { $in: [0, null] };
    } else if (!isNaN(Number(dnpVal))) {
      filter.dnpCount = Number(dnpVal);
    }
  }

  const [enquiries, total] = await Promise.all([
    Enquiry.find(filter)
      .populate('assignedTo', 'firstName lastName')
      .populate('notes.by', 'firstName lastName')
      .populate('callLog.by', 'firstName lastName')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
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

// @desc    Get all enquiries (admin/manager only)
// @route   GET /api/enquiries
export const getAllEnquiries = asyncHandler(async (req: Request, res: Response) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 10;
  const skip = (page - 1) * limit;

  const filter: Record<string, unknown> = {};
  if (req.query.status && req.query.status !== 'all') {
    const rawStatuses = String(req.query.status).split(',').map((s) => s.trim()).filter(Boolean);
    if (rawStatuses.length > 1) {
      const expanded: string[] = [];
      for (const st of rawStatuses) {
        if (st === 'new' || st === 'begin') {
          expanded.push('new', 'begin');
        } else {
          expanded.push(st);
        }
      }
      filter.status = { $in: Array.from(new Set(expanded)) };
    } else if (rawStatuses[0] === 'new' || rawStatuses[0] === 'begin') {
      filter.status = { $in: ['new', 'begin'] };
    } else {
      filter.status = rawStatuses[0];
    }
  }

  if (req.query.dnp) {
    const dnpVal = String(req.query.dnp).toLowerCase().trim();
    if (dnpVal === 'any' || dnpVal === 'all' || dnpVal === 'true') {
      filter.dnpCount = { $gt: 0 };
    } else if (dnpVal === '6+' || dnpVal === '6plus') {
      filter.dnpCount = { $gte: 6 };
    } else if (dnpVal === '0' || dnpVal === 'none') {
      filter.dnpCount = { $in: [0, null] };
    } else if (!isNaN(Number(dnpVal))) {
      filter.dnpCount = Number(dnpVal);
    }
  }
  if (req.query.type) filter.type = req.query.type;
  
  const fullAccessRoles = ['admin', 'manager', 'sales-manager'];
  if (!fullAccessRoles.includes(req.user?.role || '')) {
    filter.assignedTo = req.user?._id;
  } else if (req.query.assignedTo && req.query.assignedTo !== 'all') {
    if (req.query.assignedTo === 'unassigned' || req.query.assignedTo === 'none' || req.query.assignedTo === '') {
      filter.assignedTo = { $in: [null, undefined] };
    } else {
      filter.assignedTo = req.query.assignedTo;
    }
  }
  if (req.query.priority) filter.priority = req.query.priority;
  if (req.query.channel && req.query.channel !== 'all') {
    const rawChannels = String(req.query.channel).split(',').map((c) => c.trim()).filter(Boolean);
    if (rawChannels.length > 1) {
      filter.channel = { $in: rawChannels };
    } else if (rawChannels.length === 1) {
      filter.channel = rawChannels[0];
    }
  }
  if (req.query.destination) filter.destination = new RegExp(req.query.destination as string, 'i');
  if (req.query.travellerCount) filter.travellerCount = parseInt(req.query.travellerCount as string);

  // Text search across name, email, phone, packageName
  if (req.query.search) {
    const s = req.query.search as string;
    filter.$or = [
      { firstName: new RegExp(s, 'i') },
      { lastName: new RegExp(s, 'i') },
      { email: new RegExp(s, 'i') },
      { phone: new RegExp(s, 'i') },
      { packageName: new RegExp(s, 'i') },
    ];
  }

  // Lead Age / Freshness filter (stackable with employee & status)
  const dateFilter: Record<string, Date> = {};
  if (req.query.from) dateFilter.$gte = new Date(req.query.from as string);
  if (req.query.to) dateFilter.$lte = new Date(req.query.to as string);

  if (req.query.leadAge) {
    const ageVal = String(req.query.leadAge).toLowerCase().trim();
    const nowMs = Date.now();
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    if (ageVal === 'today') {
      dateFilter.$gte = startOfToday;
    } else if (ageVal === 'new' || ageVal === '3days' || ageVal === 'recent') {
      dateFilter.$gte = new Date(nowMs - 3 * 24 * 60 * 60 * 1000);
    } else if (ageVal === '7days') {
      dateFilter.$gte = new Date(nowMs - 7 * 24 * 60 * 60 * 1000);
    } else if (ageVal === 'old' || ageVal === 'older7days') {
      dateFilter.$lte = new Date(nowMs - 7 * 24 * 60 * 60 * 1000);
    } else if (ageVal === 'older14days') {
      dateFilter.$lte = new Date(nowMs - 14 * 24 * 60 * 60 * 1000);
    } else if (ageVal === 'older30days') {
      dateFilter.$lte = new Date(nowMs - 30 * 24 * 60 * 60 * 1000);
    }
  }

  if (Object.keys(dateFilter).length > 0) {
    filter.createdAt = dateFilter;
  }

  const [enquiries, total] = await Promise.all([
    Enquiry.find(filter)
      .populate('assignedTo', 'firstName lastName')
      .populate('notes.by', 'firstName lastName')
      .populate('callLog.by', 'firstName lastName')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
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

// @desc    Get enquiry by ID
// @route   GET /api/enquiries/:id
export const getEnquiryById = asyncHandler(async (req: Request, res: Response) => {
  const enquiry = await Enquiry.findById(req.params.id)
    .populate({
      path: 'package',
      select: 'name slug price isInternational duration destination customDestinationText',
      populate: { path: 'destination', select: 'name' },
    })
    .populate('assignedTo', 'firstName lastName email avatar')
    .populate('notes.by', 'firstName lastName')
    .populate('callLog.by', 'firstName lastName')
    .populate('timeline.by', 'firstName lastName')
    .populate('bookingRef', 'bookingId bookingStatus paymentStatus paymentFinanceStatus totalAmount paidAmount');

  if (!enquiry) {
    throw new AppError('Enquiry not found', 404);
  }

  // Staff can only view enquiries assigned to them (or unassigned)
  const user = req.user!;
  const restrictedRoles = ['staff', 'sales-staff'];
  if (restrictedRoles.includes(user.role) && enquiry.assignedTo) {
    const assignedId = (enquiry.assignedTo as any)._id ? (enquiry.assignedTo as any)._id.toString() : enquiry.assignedTo.toString();
    if (assignedId !== user._id.toString()) {
      throw new AppError('Access denied', 403);
    }
  }

  // Fetch all packages linked to this enquiry and past activity logs
  const [linkedItineraries, activityLogs] = await Promise.all([
    Package.find({ enquiryId: enquiry._id })
      .select('_id name slug price isInternational duration destination customDestinationText')
      .populate('destination', 'name')
      .lean(),
    ActivityLog.find({ entity: 'enquiry', entityId: String(enquiry._id) })
      .sort({ createdAt: -1 })
      .lean(),
  ]);

  // Auto-heal and persist destination if enquiry.destination is empty
  if (!enquiry.destination) {
    const pkg: any = enquiry.package;
    let resolvedDest = pkg?.destination?.name || pkg?.customDestinationText;
    if (!resolvedDest && linkedItineraries && linkedItineraries.length > 0) {
      const firstLinked: any = linkedItineraries[0];
      resolvedDest = firstLinked?.destination?.name || firstLinked?.customDestinationText;
    }
    if (resolvedDest) {
      enquiry.destination = resolvedDest;
      await Enquiry.findByIdAndUpdate(enquiry._id, { destination: resolvedDest });
    }
  }

  res.status(200).json({
    status: 'success',
    data: {
      ...enquiry.toJSON(),
      linkedItineraries,
      activityLogs,
    },
  });
});

// @desc    Update enquiry (status, notes, reassign, follow-up date)
// @route   PUT /api/enquiries/:id
export const updateEnquiry = asyncHandler(async (req: Request, res: Response) => {
  const enquiry = await Enquiry.findById(req.params.id);

  if (!enquiry) {
    throw new AppError('Enquiry not found', 404);
  }

  // Staff can only update enquiries assigned to them (or unassigned)
  const user = req.user!;
  if ((user.role === 'staff' || user.role === 'sales-staff') && enquiry.assignedTo) {
    const assignedId = (enquiry.assignedTo as any)._id ? (enquiry.assignedTo as any)._id.toString() : enquiry.assignedTo.toString();
    if (assignedId !== user._id.toString()) {
      throw new AppError('Access denied. This enquiry is not assigned to you.', 403);
    }
  }

  const prevStatus = enquiry.status;
  const prevPriority = enquiry.priority;
  const prevAssignedTo = enquiry.assignedTo ? String(enquiry.assignedTo) : undefined;
  const prevDestination = enquiry.destination;
  const prevTravellerCount = enquiry.travellerCount;
  const prevAdultCount = enquiry.adultCount;
  const prevChildCount = enquiry.childCount;
  const prevInfantCount = enquiry.infantCount;
  const prevBudget = enquiry.budget;
  const prevTravelDate = enquiry.travelDate ? new Date(enquiry.travelDate).toISOString() : undefined;
  const prevTags = [...(enquiry.tags || [])];

  const actorName = req.user ? `${req.user.firstName} ${req.user.lastName || ''}`.trim() : 'Staff';
  enquiry.timeline = enquiry.timeline || [];

  // ── Contact / identity fields ──────────────────────────────────────────────
  if (req.body.firstName !== undefined) enquiry.firstName = req.body.firstName;
  if (req.body.lastName  !== undefined) enquiry.lastName  = req.body.lastName;
  if (req.body.email     !== undefined) enquiry.email     = req.body.email;
  if (req.body.phone     !== undefined) enquiry.phone     = req.body.phone;
  if (req.body.destination   !== undefined) enquiry.destination   = req.body.destination;
  if (req.body.travelDate    !== undefined) enquiry.travelDate    = req.body.travelDate ? new Date(req.body.travelDate) : undefined;
  if (req.body.packageName   !== undefined) enquiry.packageName   = req.body.packageName;
  if (req.body.source        !== undefined) enquiry.source        = req.body.source;
  if (req.body.departureId   !== undefined) enquiry.departureId   = req.body.departureId;

  // NOTE: Enquiry contact fields (firstName, email, phone, etc.) are intentionally
  // NOT synced back to the linked User account. The enquiry document is lead-capture
  // data that belongs to the CRM; the User document controls login credentials and
  // account identity. Auto-propagating enquiry edits to user accounts would allow
  // accidental or malicious mutation of customer/admin account details.

  // ── Status changes ─────────────────────────────────────────────────────────
  if (req.body.status) {
    if (req.body.status !== 'dnp' && prevStatus === 'dnp') {
      enquiry.dnpCount = 0; // Clear DNP count when moving away from DNP stage
    }
    enquiry.status = req.body.status;
  }
  if (req.body.priority) enquiry.priority = req.body.priority;

  if (req.body.status && req.body.status !== prevStatus) {
    if (req.body.status === 'closed') {
      const lostText = req.body.lostReason || enquiry.lostReason || 'Closed';
      const otherNote = req.body.lostReasonOtherText ? ` ("${req.body.lostReasonOtherText}")` : '';
      enquiry.timeline.push({
        type: 'closed',
        title: 'Lead closed / marked as lost',
        description: `Reason: ${lostText}${otherNote}`,
        by: req.user!._id,
        byName: actorName,
        date: new Date(),
        meta: { prevStatus, newStatus: 'closed', lostReason: lostText, lostReasonOtherText: req.body.lostReasonOtherText },
      });
    } else if (req.body.status === 'converted') {
      enquiry.timeline.push({
        type: 'converted',
        title: 'Lead marked as Converted',
        description: `Status updated from ${prevStatus} to converted`,
        by: req.user!._id,
        byName: actorName,
        date: new Date(),
        meta: { prevStatus, newStatus: 'converted' },
      });
    } else {
      enquiry.timeline.push({
        type: 'status_change',
        title: `Status changed: ${prevStatus} → ${req.body.status}`,
        description: `Status moved to ${req.body.status} by ${actorName}`,
        by: req.user!._id,
        byName: actorName,
        date: new Date(),
        meta: { prevStatus, newStatus: req.body.status },
      });
    }
  }

  // ── Priority changes ───────────────────────────────────────────────────────
  if (req.body.priority && req.body.priority !== prevPriority) {
    enquiry.timeline.push({
      type: 'priority_change',
      title: `Priority changed: ${prevPriority} → ${req.body.priority}`,
      description: `Priority updated to ${req.body.priority.toUpperCase()} by ${actorName}`,
      by: req.user!._id,
      byName: actorName,
      date: new Date(),
      meta: { prevPriority, newPriority: req.body.priority },
    });
  }

  // ── Follow-up date / notes ────────────────────────────────────────────────
  if (req.body.followUpDate !== undefined) {
    enquiry.followUpDate = req.body.followUpDate ? new Date(req.body.followUpDate) : undefined;
    
    if (req.body.followUpDate) {
      const dateObj = new Date(req.body.followUpDate);
      const hasTime = dateObj.getHours() !== 0 || dateObj.getMinutes() !== 0;
      const fDate = hasTime
        ? dateObj.toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true })
        : dateObj.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
      const fNotes = req.body.followUpNotes ? ` (Notes: ${req.body.followUpNotes})` : '';
      enquiry.notes.push({
        text: `Scheduled follow-up for ${fDate}${fNotes}`,
        by: req.user!._id,
        date: new Date(),
      });

      enquiry.timeline.push({
        type: 'follow_up',
        title: `Follow-up scheduled for ${fDate}`,
        description: req.body.followUpNotes ? `Notes: "${req.body.followUpNotes}"` : `Follow-up set by ${actorName}`,
        by: req.user!._id,
        byName: actorName,
        date: new Date(),
        meta: { followUpDate: req.body.followUpDate, followUpNotes: req.body.followUpNotes },
      });
    }
  }
  if (req.body.followUpNotes !== undefined) enquiry.followUpNotes = req.body.followUpNotes;
  if (req.body.adultCount !== undefined) enquiry.adultCount = req.body.adultCount;
  if (req.body.childCount !== undefined) enquiry.childCount = req.body.childCount;
  if (req.body.infantCount !== undefined) enquiry.infantCount = req.body.infantCount;
  if (req.body.travellerCount !== undefined) {
    enquiry.travellerCount = req.body.travellerCount;
  } else if (req.body.adultCount !== undefined || req.body.childCount !== undefined || req.body.infantCount !== undefined) {
    enquiry.travellerCount = (enquiry.adultCount || 0) + (enquiry.childCount || 0) + (enquiry.infantCount || 0);
  }
  if (req.body.budget !== undefined) enquiry.budget = req.body.budget;
  if (req.body.tags !== undefined) enquiry.tags = req.body.tags;
  if (req.body.channel !== undefined) enquiry.channel = req.body.channel;

  // ── Staff assignment ───────────────────────────────────────────────────────
  if (req.body.assignedTo !== undefined) {
    if (!req.body.assignedTo || req.body.assignedTo === 'unassigned' || req.body.assignedTo === 'none') {
      const wasAssigned = Boolean(enquiry.assignedTo);
      enquiry.assignedTo = undefined;
      if (enquiry.status === 'assigned') enquiry.status = 'new';
      if (wasAssigned) {
        enquiry.timeline.push({
          type: 'assignment',
          title: 'Lead unassigned',
          description: `Unassigned by ${actorName}`,
          by: req.user!._id,
          byName: actorName,
          date: new Date(),
        });
      }
    } else {
      const isNewAssignment = String(req.body.assignedTo) !== prevAssignedTo;
      enquiry.assignedTo = req.body.assignedTo;
      // When an inquiry is assigned to someone, it is marked as a new lead
      if (isNewAssignment || enquiry.status === 'assigned') {
        enquiry.status = 'new';
      }

      if (isNewAssignment) {
        const staffMember = await User.findById(req.body.assignedTo);
        if (staffMember) {
          const targetStaffName = `${staffMember.firstName} ${staffMember.lastName || ''}`.trim();
          enquiry.timeline.push({
            type: 'assignment',
            title: `Lead assigned to ${targetStaffName}`,
            description: `Assigned by ${actorName}`,
            by: req.user!._id,
            byName: actorName,
            date: new Date(),
            meta: { assignedTo: req.body.assignedTo, staffName: targetStaffName },
          });

          // Notify the newly assigned staff member (fire-and-forget)
          sendStaffEnquiryAssigned(
            staffMember.email,
            staffMember.firstName,
            `${enquiry.firstName} ${enquiry.lastName || ''}`.trim(),
            enquiry.type,
            enquiry.packageName,
          ).catch(console.error);
        }
      }
    }
  }

  // ── Trip Requirements changes ─────────────────────────────────────────────
  const reqDiffs: string[] = [];
  if (req.body.destination !== undefined && req.body.destination !== prevDestination) reqDiffs.push(`Destination: ${req.body.destination}`);
  if (
    (req.body.travellerCount !== undefined && req.body.travellerCount !== prevTravellerCount) ||
    (req.body.adultCount !== undefined && req.body.adultCount !== prevAdultCount) ||
    (req.body.childCount !== undefined && req.body.childCount !== prevChildCount) ||
    (req.body.infantCount !== undefined && req.body.infantCount !== prevInfantCount)
  ) {
    const parts: string[] = [];
    if (enquiry.adultCount != null) parts.push(`${enquiry.adultCount} Adult${enquiry.adultCount === 1 ? '' : 's'}`);
    if (enquiry.childCount != null && enquiry.childCount > 0) parts.push(`${enquiry.childCount} Child${enquiry.childCount === 1 ? '' : 'ren'}`);
    if (enquiry.infantCount != null && enquiry.infantCount > 0) parts.push(`${enquiry.infantCount} Infant${enquiry.infantCount === 1 ? '' : 's'}`);
    const details = parts.length > 0 ? ` (${parts.join(', ')})` : '';
    reqDiffs.push(`Travellers: ${enquiry.travellerCount ?? 0} pax${details}`);
  }
  if (req.body.budget !== undefined && req.body.budget !== prevBudget) reqDiffs.push(`Budget: ₹${Number(req.body.budget).toLocaleString('en-IN')}`);
  if (req.body.travelDate !== undefined && (req.body.travelDate ? new Date(req.body.travelDate).toISOString() : undefined) !== prevTravelDate) {
    reqDiffs.push(`Travel Date: ${req.body.travelDate ? new Date(req.body.travelDate).toLocaleDateString('en-IN') : 'Cleared'}`);
  }
  if (reqDiffs.length > 0) {
    enquiry.timeline.push({
      type: 'requirements',
      title: 'Trip requirements updated',
      description: reqDiffs.join(' • '),
      by: req.user!._id,
      byName: actorName,
      date: new Date(),
    });
  }

  // ── Tags changes ──────────────────────────────────────────────────────────
  if (req.body.tags && JSON.stringify(req.body.tags) !== JSON.stringify(prevTags)) {
    enquiry.timeline.push({
      type: 'system',
      title: `Tags updated: ${(req.body.tags || []).join(', ') || 'None'}`,
      by: req.user!._id,
      byName: actorName,
      date: new Date(),
    });
  }

  // Require lostReason when closing
  if (req.body.status === 'closed') {
    if (!req.body.lostReason && !enquiry.lostReason) {
      throw new AppError('A lostReason is required when closing an enquiry', 400);
    }
    if (req.body.lostReason) enquiry.lostReason = req.body.lostReason;
  }

  // Push a note if provided
  if (req.body.note) {
    enquiry.notes.push({
      text: req.body.note,
      by: req.user!._id,
      date: new Date(),
    });
    enquiry.timeline.push({
      type: 'note',
      title: 'Internal note added',
      description: req.body.note,
      by: req.user!._id,
      byName: actorName,
      date: new Date(),
    });
  }

  await enquiry.save();

  // Log activity on status changes
  if (req.body.status && req.body.status !== prevStatus) {
    await logActivity({
      req,
      action: 'status_change',
      entity: 'enquiry',
      entityId: String(enquiry._id),
      entityName: `${enquiry.firstName} ${enquiry.lastName || ''}`.trim(),
      description: `Enquiry for ${enquiry.firstName} — status changed: ${prevStatus} → ${enquiry.status}`,
      meta: { prevStatus, newStatus: enquiry.status, priority: enquiry.priority },
    });
  }

  const updated = await Enquiry.findById(enquiry._id)
    .populate('assignedTo', 'firstName lastName')
    .populate('notes.by', 'firstName lastName')
    .populate('callLog.by', 'firstName lastName')
    .populate('timeline.by', 'firstName lastName');

  res.status(200).json({
    status: 'success',
    data: updated,
  });
});

// @desc    Log a call attempt on an enquiry
// @route   POST /api/enquiries/:id/call
export const logCall = asyncHandler(async (req: Request, res: Response) => {
  const enquiry = await Enquiry.findById(req.params.id);
  if (!enquiry) throw new AppError('Enquiry not found', 404);

  // Staff can only log calls on their assigned enquiries
  const user = req.user!;
  if ((user.role === 'staff' || user.role === 'sales-staff') && enquiry.assignedTo) {
    const assignedId = (enquiry.assignedTo as any)._id ? (enquiry.assignedTo as any)._id.toString() : enquiry.assignedTo.toString();
    if (assignedId !== user._id.toString()) {
      throw new AppError('Access denied', 403);
    }
  }

  const { outcome, notes, duration, callbackDate } = req.body;
  if (!outcome) throw new AppError('outcome is required', 400);

  let parsedCallbackDate: Date | undefined;
  if (outcome === 'callback-scheduled') {
    if (!callbackDate) {
      throw new AppError('Date and time are required for scheduling a callback', 400);
    }
    parsedCallbackDate = new Date(callbackDate);
    if (isNaN(parsedCallbackDate.getTime())) {
      throw new AppError('Invalid callback date and time', 400);
    }
    // Update enquiry follow-up tracking
    enquiry.followUpDate = parsedCallbackDate;
    enquiry.followUpNotes = notes ? `Callback: ${notes}` : 'Customer requested callback';
    if (enquiry.status !== 'converted' && enquiry.status !== 'closed' && enquiry.status !== 'resolved') {
      enquiry.status = 'callback-scheduled';
    }
  }

  // Push call log entry
  enquiry.callLog.push({
    attemptedAt: new Date(),
    outcome,
    notes: notes || undefined,
    by: req.user!._id,
    duration: duration || undefined,
    callbackDate: parsedCallbackDate,
  });

  const prevDnp = enquiry.dnpCount;

  // DNP logic: increment counter and set status to 'dnp'
  if (outcome === 'dnp') {
    enquiry.dnpCount = (enquiry.dnpCount || 0) + 1;
    if (enquiry.status !== 'converted' && enquiry.status !== 'closed' && enquiry.status !== 'resolved') {
      enquiry.status = 'dnp';
    }
  }

  // Answered: record contact time, reset DNP counter, set status to 'responded'
  if (outcome === 'answered') {
    enquiry.lastContactedAt = new Date();
    enquiry.dnpCount = 0; // Customer answered: reset DNP count so it turns green
    if (enquiry.status !== 'converted' && enquiry.status !== 'closed' && enquiry.status !== 'resolved') {
      enquiry.status = 'responded';
    }
  }

  // Busy: set status to 'busy'
  if (outcome === 'busy') {
    if (enquiry.status !== 'converted' && enquiry.status !== 'closed' && enquiry.status !== 'resolved') {
      enquiry.status = 'busy';
    }
  }

  // WhatsApp sent: set status to 'whatsapp-sent'
  if (outcome === 'whatsapp-sent') {
    if (enquiry.status !== 'converted' && enquiry.status !== 'closed' && enquiry.status !== 'resolved' && enquiry.status !== 'responded') {
      enquiry.status = 'whatsapp-sent';
    }
  }

  // Email sent
  if (outcome === 'email-sent') {
    if (enquiry.status !== 'converted' && enquiry.status !== 'closed' && enquiry.status !== 'resolved' && enquiry.status !== 'responded') {
      enquiry.status = 'in-progress';
    }
  }

  const actorName = user ? `${user.firstName} ${user.lastName || ''}`.trim() : 'Staff';
  enquiry.timeline = enquiry.timeline || [];

  const formattedCallback = parsedCallbackDate
    ? parsedCallbackDate.toLocaleString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      })
    : '';

  enquiry.timeline.push({
    type: 'call',
    title:
      outcome === 'callback-scheduled' && formattedCallback
        ? `Callback Scheduled: ${formattedCallback}`
        : `Call logged: ${outcome.replace('-', ' ')}${duration ? ` (${duration}s)` : ''}`,
    description: notes
      ? `"${notes}"`
      : outcome === 'callback-scheduled' && formattedCallback
      ? `Customer requested a callback on ${formattedCallback}`
      : undefined,
    by: user._id,
    byName: actorName,
    date: new Date(),
    meta: {
      outcome,
      duration,
      notes,
      callbackDate: parsedCallbackDate,
      dnpCount: enquiry.dnpCount,
    },
  });

  await enquiry.save();

  // Log activity
  await logActivity({
    req,
    action: 'other',
    entity: 'enquiry',
    entityId: String(enquiry._id),
    entityName: `${enquiry.firstName} ${enquiry.lastName || ''}`.trim(),
    description:
      outcome === 'callback-scheduled' && formattedCallback
        ? `Callback scheduled for ${enquiry.firstName} on ${formattedCallback}${notes ? ` — "${notes}"` : ''}`
        : `Call logged for ${enquiry.firstName}: ${outcome}${notes ? ` — "${notes}"` : ''}`,
    meta: { outcome, dnpCount: enquiry.dnpCount, duration, callbackDate: parsedCallbackDate },
  });

  // DNP escalation emails (fire-and-forget)
  if (outcome === 'dnp') {
    const newDnp = enquiry.dnpCount;

    if (newDnp === 3 && prevDnp < 3) {
      // Alert manager at DNP 3
      const managers = await User.find({ role: { $in: ['admin', 'manager'] }, isVerified: true });
      for (const mgr of managers) {
        const assignedStaffName = user ? `${user.firstName} ${user.lastName || ''}`.trim() : 'Staff';
        sendDNP3Alert(mgr.email, `${enquiry.firstName} ${enquiry.lastName || ''}`.trim(), assignedStaffName).catch(console.error);
      }
    }

    if (newDnp >= 6 && prevDnp < 6) {
      // Alert admin + manager at DNP 6
      const admins = await User.find({ role: { $in: ['admin', 'manager'] }, isVerified: true });
      for (const admin of admins) {
        sendDNP6Alert(admin.email, `${enquiry.firstName} ${enquiry.lastName || ''}`.trim()).catch(console.error);
      }
    }
  }

  const updated = await Enquiry.findById(enquiry._id)
    .populate('callLog.by', 'firstName lastName')
    .populate('assignedTo', 'firstName lastName')
    .populate('notes.by', 'firstName lastName')
    .populate('timeline.by', 'firstName lastName');

  res.status(200).json({ status: 'success', data: updated });
});

// @desc    Bulk update enquiries (reassign, close, mark follow-up)
// @route   POST /api/enquiries/bulk
export const bulkUpdateEnquiries = asyncHandler(async (req: Request, res: Response) => {
  const { ids, action, payload } = req.body;

  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    throw new AppError('ids array is required', 400);
  }
  if (!action) throw new AppError('action is required', 400);

  let setOp: Record<string, unknown> = {};
  let pushEvent: any = null;
  const staffName = req.user ? `${req.user.firstName} ${req.user.lastName || ''}`.trim() : 'Staff';

  if (action === 'reassign') {
    if (!payload?.assignedTo) throw new AppError('payload.assignedTo is required for reassign', 400);
    const targetStaff = await User.findById(payload.assignedTo);
    const targetStaffName = targetStaff ? `${targetStaff.firstName} ${targetStaff.lastName || ''}`.trim() : 'Staff';
    setOp = { assignedTo: payload.assignedTo, status: 'new' };
    pushEvent = {
      type: 'assignment',
      title: `Bulk reassigned to ${targetStaffName} (New Lead)`,
      description: `Reassigned by ${staffName}`,
      by: req.user!._id,
      byName: staffName,
      date: new Date(),
    };
  } else if (action === 'close') {
    setOp = { status: 'closed', lostReason: payload?.lostReason || 'other' };
    pushEvent = {
      type: 'closed',
      title: 'Bulk closed / marked lost',
      description: `Reason: ${payload?.lostReason || 'other'} • Closed by ${staffName}`,
      by: req.user!._id,
      byName: staffName,
      date: new Date(),
    };
  } else if (action === 'mark-follow-up') {
    const fDate = payload?.followUpDate ? new Date(payload.followUpDate).toLocaleDateString('en-IN') : 'Scheduled';
    setOp = { status: 'follow-up', followUpDate: payload?.followUpDate ? new Date(payload.followUpDate) : undefined };
    pushEvent = {
      type: 'follow_up',
      title: `Follow-up scheduled for ${fDate}`,
      description: `Scheduled via bulk action by ${staffName}`,
      by: req.user!._id,
      byName: staffName,
      date: new Date(),
    };
  } else if (action === 'unassign') {
    setOp = { assignedTo: null, status: 'new' };
    pushEvent = {
      type: 'assignment',
      title: 'Bulk unassigned (returned to lead pool)',
      description: `Unassigned by ${staffName}`,
      by: req.user!._id,
      byName: staffName,
      date: new Date(),
    };
  } else {
    throw new AppError('Invalid action. Use: reassign | unassign | close | mark-follow-up', 400);
  }

  const updateOp: any = { $set: setOp };
  if (pushEvent) {
    updateOp.$push = { timeline: pushEvent };
  }

  const result = await Enquiry.updateMany({ _id: { $in: ids } }, updateOp);

  await logActivity({
    req,
    action: 'update',
    entity: 'enquiry',
    entityId: ids.join(','),
    entityName: `${ids.length} enquiries`,
    description: `Bulk action "${action}" applied to ${ids.length} enquiries`,
    meta: { ids, action, payload },
  });

  res.status(200).json({
    status: 'success',
    message: `${result.modifiedCount} enquiries updated`,
    data: { modifiedCount: result.modifiedCount },
  });
});

// @desc    Get CRM pipeline stats
// @route   GET /api/enquiries/stats
export const getEnquiryStats = asyncHandler(async (req: Request, res: Response) => {
  // Optional date filter (default: current month)
  const now = new Date();
  const fromDate = req.query.from
    ? new Date(req.query.from as string)
    : new Date(now.getFullYear(), now.getMonth(), 1);
  const toDate = req.query.to ? new Date(req.query.to as string) : now;

  const dateFilter: any = { createdAt: { $gte: fromDate, $lte: toDate } };

  const fullAccessRoles = ['admin', 'manager', 'sales-manager'];
  if (!fullAccessRoles.includes(req.user?.role || '')) {
    dateFilter.assignedTo = req.user?._id;
  }

  const [
    byStatus,
    channelBreakdown,
    dnpBreakdown,
    conversionData,
    staffData,
    followUpsDueToday,
  ] = await Promise.all([
    // Count by each status
    Enquiry.aggregate([
      { $match: dateFilter },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]),

    // Count by channel
    Enquiry.aggregate([
      { $match: dateFilter },
      { $group: { _id: '$channel', count: { $sum: 1 } } },
    ]),

    // DNP breakdown
    Enquiry.aggregate([
      { $match: { ...dateFilter, dnpCount: { $gt: 0 } } },
      {
        $group: {
          _id: null,
          dnp1: { $sum: { $cond: [{ $eq: ['$dnpCount', 1] }, 1, 0] } },
          dnp2: { $sum: { $cond: [{ $eq: ['$dnpCount', 2] }, 1, 0] } },
          dnp3: { $sum: { $cond: [{ $eq: ['$dnpCount', 3] }, 1, 0] } },
          dnp4: { $sum: { $cond: [{ $eq: ['$dnpCount', 4] }, 1, 0] } },
          dnp5: { $sum: { $cond: [{ $eq: ['$dnpCount', 5] }, 1, 0] } },
          dnp6plus: { $sum: { $cond: [{ $gte: ['$dnpCount', 6] }, 1, 0] } },
        },
      },
    ]),

    // Conversion value total + avg time to convert
    Enquiry.aggregate([
      { $match: { ...dateFilter, status: 'converted', conversionValue: { $exists: true } } },
      {
        $group: {
          _id: null,
          totalConversionValue: { $sum: '$conversionValue' },
          avgDaysToConvert: {
            $avg: {
              $divide: [
                { $subtract: ['$updatedAt', '$createdAt'] },
                1000 * 60 * 60 * 24, // ms → days
              ],
            },
          },
          count: { $sum: 1 },
        },
      },
    ]),

    // Per-staff performance
    Enquiry.aggregate([
      { $match: dateFilter },
      {
        $group: {
          _id: '$assignedTo',
          assigned: { $sum: 1 },
          converted: { $sum: { $cond: [{ $eq: ['$status', 'converted'] }, 1, 0] } },
          totalValue: { $sum: '$conversionValue' },
        },
      },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'staff',
        },
      },
      { $unwind: { path: '$staff', preserveNullAndEmptyArrays: true } },

      {
        $project: {
          staffName: { $concat: ['$staff.firstName', ' ', { $ifNull: ['$staff.lastName', ''] }] },
          assigned: 1,
          converted: 1,
          totalValue: 1,
          conversionRate: {
            $cond: [
              { $gt: ['$assigned', 0] },
              { $multiply: [{ $divide: ['$converted', '$assigned'] }, 100] },
              0,
            ],
          },
        },
      },
      { $sort: { converted: -1 } },
    ]),

    // Follow-ups due today
    Enquiry.countDocuments({
      followUpDate: {
        $gte: new Date(now.setHours(0, 0, 0, 0)),
        $lte: new Date(now.setHours(23, 59, 59, 999)),
      },
      status: { $nin: ['converted', 'closed', 'resolved'] },
    }),
  ]);

  // Shape byStatus into a flat object
  const statusMap: Record<string, number> = {};
  for (const s of byStatus) statusMap[s._id] = s.count;
  const total = Object.values(statusMap).reduce((a, b) => a + b, 0);
  const convertedCount = statusMap['converted'] || 0;
  const conversionRate = total > 0 ? Math.round((convertedCount / total) * 100) : 0;

  // Shape channel breakdown
  const byChannel: Record<string, number> = {};
  for (const c of channelBreakdown) byChannel[c._id || 'unknown'] = c.count;

  const conv = conversionData[0] || { totalConversionValue: 0, avgDaysToConvert: 0, count: 0 };
  const dnp = dnpBreakdown[0] || { dnp1: 0, dnp2: 0, dnp3: 0, dnp4: 0, dnp5: 0, dnp6plus: 0 };

  res.status(200).json({
    status: 'success',
    data: {
      period: { from: fromDate, to: toDate },
      total,
      byStatus: statusMap,
      conversionRate,
      convertedCount,
      avgDaysToConvert: Math.round((conv.avgDaysToConvert || 0) * 10) / 10,
      totalConversionValue: conv.totalConversionValue || 0,
      dnpBreakdown: { dnp1: dnp.dnp1, dnp2: dnp.dnp2, dnp3: dnp.dnp3, dnp4: dnp.dnp4, dnp5: dnp.dnp5, dnp6plus: dnp.dnp6plus },
      byChannel,
      byStaff: staffData,
      followUpsDueToday,
    },
  });
});

// @desc    Get sales staff pipeline matrix / breakdown (leads per salesperson across statuses)
// @route   GET /api/enquiries/pipeline/matrix
export const getPipelineStaffMatrix = asyncHandler(async (req: Request, res: Response) => {
  const fullAccessRoles = ['admin', 'manager', 'sales-manager'];
  const isFullAccess = fullAccessRoles.includes(req.user?.role || '');

  // 1. Fetch sales staff members
  let staffMembers: any[] = [];
  if (isFullAccess) {
    staffMembers = await User.find({
      role: { $in: ['admin', 'manager', 'sales-manager', 'sales-staff', 'staff'] },
      isActive: { $ne: false },
    })
      .select('_id firstName lastName email role')
      .sort({ firstName: 1 })
      .lean();
  } else {
    staffMembers = await User.find({ _id: req.user?._id })
      .select('_id firstName lastName email role')
      .lean();
  }

  // 2. Active enquiries query (exclude closed & resolved from active pipeline)
  const matchFilter: any = {
    status: { $nin: ['closed', 'resolved'] },
  };

  if (!isFullAccess) {
    matchFilter.assignedTo = req.user?._id;
  }

  // Optional date filter
  if (req.query.from || req.query.to) {
    const dateFilter: Record<string, Date> = {};
    if (req.query.from) dateFilter.$gte = new Date(req.query.from as string);
    if (req.query.to) dateFilter.$lte = new Date(req.query.to as string);
    matchFilter.createdAt = dateFilter;
  }

  // 3. Aggregate by assignedTo and status
  const aggregateResult = await Enquiry.aggregate([
    { $match: matchFilter },
    {
      $group: {
        _id: {
          assignedTo: '$assignedTo',
          status: '$status',
        },
        count: { $sum: 1 },
        totalValue: { $sum: { $ifNull: ['$budget', '$conversionValue', 0] } },
      },
    },
  ]);

  // 4. Aggregate extra DNP and today's follow-up stats
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

  const extraStats = await Enquiry.aggregate([
    { $match: matchFilter },
    {
      $group: {
        _id: '$assignedTo',
        dnpAny: { $sum: { $cond: [{ $gt: ['$dnpCount', 0] }, 1, 0] } },
        followUpToday: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $ne: ['$followUpDate', null] },
                  { $gte: ['$followUpDate', startOfDay] },
                  { $lte: ['$followUpDate', endOfDay] },
                ],
              },
              1,
              0,
            ],
          },
        },
      },
    },
  ]);

  const extraMap = new Map<string, { dnpAny: number; followUpToday: number }>();
  for (const item of extraStats) {
    const key = item._id ? item._id.toString() : 'unassigned';
    extraMap.set(key, {
      dnpAny: item.dnpAny || 0,
      followUpToday: item.followUpToday || 0,
    });
  }

  // Initialize per-staff container
  const staffMap = new Map<string, any>();
  for (const staff of staffMembers) {
    const sId = staff._id.toString();
    staffMap.set(sId, {
      _id: sId,
      firstName: staff.firstName,
      lastName: staff.lastName || '',
      fullName: `${staff.firstName} ${staff.lastName || ''}`.trim(),
      email: staff.email,
      role: staff.role,
      total: 0,
      byStatus: {
        new: 0,
        begin: 0,
        assigned: 0,
        responded: 0,
        'in-progress': 0,
        'follow-up': 0,
        dnp: 0,
        busy: 0,
        'callback-scheduled': 0,
        'callback-requested': 0,
        'whatsapp-sent': 0,
        negotiation: 0,
        converted: 0,
      },
      dnpCount: 0,
      followUpTodayCount: 0,
      pipelineValue: 0,
    });
  }

  // Unassigned leads bucket (visible to managers)
  let unassignedBucket: any = null;
  if (isFullAccess) {
    unassignedBucket = {
      _id: 'unassigned',
      firstName: 'Unassigned',
      lastName: '',
      fullName: 'Unassigned Leads',
      email: '',
      role: 'unassigned',
      total: 0,
      byStatus: {
        new: 0,
        begin: 0,
        assigned: 0,
        responded: 0,
        'in-progress': 0,
        'follow-up': 0,
        dnp: 0,
        busy: 0,
        'callback-scheduled': 0,
        'callback-requested': 0,
        'whatsapp-sent': 0,
        negotiation: 0,
        converted: 0,
      },
      dnpCount: 0,
      followUpTodayCount: 0,
      pipelineValue: 0,
    };
  }

  // Distribute grouped numbers
  for (const row of aggregateResult) {
    const assignedId = row._id.assignedTo ? row._id.assignedTo.toString() : 'unassigned';
    const status = row._id.status;
    const count = row.count || 0;
    const value = row.totalValue || 0;

    let target = staffMap.get(assignedId);
    if (!target && assignedId === 'unassigned' && unassignedBucket) {
      target = unassignedBucket;
    }

    if (target) {
      target.total += count;
      target.pipelineValue += value;
      if (target.byStatus[status] !== undefined) {
        target.byStatus[status] += count;
      } else {
        target.byStatus[status] = count;
      }
    }
  }

  // Attach DNP and followUpToday counts
  for (const [sId, target] of staffMap.entries()) {
    const extra = extraMap.get(sId);
    target.dnpCount = target.byStatus['dnp'] || extra?.dnpAny || 0;
    target.followUpTodayCount = extra?.followUpToday || 0;
  }
  if (unassignedBucket) {
    const extra = extraMap.get('unassigned');
    unassignedBucket.dnpCount = unassignedBucket.byStatus['dnp'] || extra?.dnpAny || 0;
    unassignedBucket.followUpTodayCount = extra?.followUpToday || 0;
  }

  const staffList = Array.from(staffMap.values());
  // Sort staff members by active lead count descending
  staffList.sort((a, b) => b.total - a.total);

  if (unassignedBucket && unassignedBucket.total > 0) {
    staffList.unshift(unassignedBucket);
  }

  // Overall pipeline totals across all displayed staff
  const totals = {
    totalLeads: staffList.reduce((acc, s) => acc + s.total, 0),
    dnp: staffList.reduce((acc, s) => acc + (s.byStatus['dnp'] || 0), 0),
    followUp: staffList.reduce((acc, s) => acc + (s.byStatus['follow-up'] || 0), 0),
    inProgress: staffList.reduce((acc, s) => acc + (s.byStatus['in-progress'] || 0), 0),
    negotiation: staffList.reduce((acc, s) => acc + (s.byStatus['negotiation'] || 0), 0),
    converted: staffList.reduce((acc, s) => acc + (s.byStatus['converted'] || 0), 0),
    newOrAssigned: staffList.reduce(
      (acc, s) =>
        acc +
        (s.byStatus['new'] || 0) +
        (s.byStatus['begin'] || 0) +
        (s.byStatus['assigned'] || 0),
      0
    ),
    pipelineValue: staffList.reduce((acc, s) => acc + s.pipelineValue, 0),
  };

  res.status(200).json({
    status: 'success',
    data: {
      staff: staffList,
      totals,
    },
  });
});

// @desc    Get enquiries with follow-up date = today
// @route   GET /api/enquiries/follow-ups/today
export const getFollowUpsToday = asyncHandler(async (req: Request, res: Response) => {
  const today = new Date();
  const startOfDay = new Date(today.setHours(0, 0, 0, 0));
  const endOfDay = new Date(today.setHours(23, 59, 59, 999));

  const filter: Record<string, unknown> = {
    followUpDate: { $gte: startOfDay, $lte: endOfDay },
    status: { $nin: ['converted', 'closed', 'resolved'] },
  };

  // Staff only see their own
  if (req.user!.role === 'staff' || req.user!.role === 'sales-staff') {
    filter.assignedTo = req.user!._id;
  }

  const enquiries = await Enquiry.find(filter)
    .populate('assignedTo', 'firstName lastName')
    .sort({ priority: 1 }); // urgent first

  res.status(200).json({
    status: 'success',
    results: enquiries.length,
    data: enquiries,
  });
});

// @desc    Export enquiries to CSV
// @route   GET /api/enquiries/export
export const exportEnquiries = asyncHandler(async (req: Request, res: Response) => {
  const filter: Record<string, unknown> = {};
  if (req.query.status && req.query.status !== 'all') {
    if (req.query.status === 'new' || req.query.status === 'begin') {
      filter.status = { $in: ['new', 'begin'] };
    } else {
      filter.status = req.query.status;
    }
  }

  if (req.query.dnp) {
    const dnpVal = String(req.query.dnp).toLowerCase().trim();
    if (dnpVal === 'any' || dnpVal === 'all' || dnpVal === 'true') {
      filter.dnpCount = { $gt: 0 };
    } else if (dnpVal === '6+' || dnpVal === '6plus') {
      filter.dnpCount = { $gte: 6 };
    } else if (dnpVal === '0' || dnpVal === 'none') {
      filter.dnpCount = { $in: [0, null] };
    } else if (!isNaN(Number(dnpVal))) {
      filter.dnpCount = Number(dnpVal);
    }
  }
  if (req.user?.role !== 'admin') {
    filter.assignedTo = req.user?._id;
  } else if (req.query.assignedTo) {
    filter.assignedTo = req.query.assignedTo;
  }
  if (req.query.destination) filter.destination = new RegExp(req.query.destination as string, 'i');
  if (req.query.travellerCount) filter.travellerCount = parseInt(req.query.travellerCount as string);
  
  if (req.query.from || req.query.to) {
    const dateFilter: Record<string, Date> = {};
    if (req.query.from) dateFilter.$gte = new Date(req.query.from as string);
    if (req.query.to) dateFilter.$lte = new Date(req.query.to as string);
    filter.createdAt = dateFilter;
  }

  const enquiries = await Enquiry.find(filter)
    .populate('assignedTo', 'firstName lastName')
    .sort({ createdAt: -1 })
    .limit(5000)
    .lean();

  const headers = [
    'ID', 'First Name', 'Last Name', 'Email', 'Phone', 'Type', 'Status', 'Priority',
    'Destination', 'Package', 'Travel Date', 'Travellers', 'Budget',
    'Channel', 'Source', 'DNP Count', 'Assigned To', 'Conversion Value',
    'Follow Up Date', 'Lost Reason', 'Created At',
  ];

  const rows = enquiries.map((e) => {
    const assigned = e.assignedTo as unknown as { firstName?: string; lastName?: string } | null;
    return [
      e._id,
      e.firstName,
      e.lastName || '',
      e.email,
      e.phone,
      e.type,
      e.status,
      e.priority,
      e.destination || '',
      e.packageName || '',
      e.travelDate ? new Date(e.travelDate).toLocaleDateString('en-IN') : '',
      e.travellerCount || '',
      e.budget || '',
      e.channel || '',
      e.source,
      e.dnpCount,
      assigned ? `${assigned.firstName || ''} ${assigned.lastName || ''}`.trim() : '',
      e.conversionValue || '',
      e.followUpDate ? new Date(e.followUpDate).toLocaleDateString('en-IN') : '',
      e.lostReason || '',
      new Date(e.createdAt).toLocaleDateString('en-IN'),
    ].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',');
  });

  const csv = [headers.join(','), ...rows].join('\n');

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="enquiries-${Date.now()}.csv"`);
  res.send(csv);
});

// @desc    Send booking link email to customer from an enquiry
// @route   POST /api/enquiries/:id/send-booking-link
export const sendBookingLinkHandler = asyncHandler(async (req: Request, res: Response) => {
  const enquiry = await Enquiry.findById(req.params.id).populate('package', 'name slug price');

  if (!enquiry) throw new AppError('Enquiry not found', 404);

  const pkg = enquiry.package as unknown as { name: string; slug: string; price?: number } | null;
  const slug = req.body.packageSlug || pkg?.slug;
  const packageName = req.body.packageName || pkg?.name || enquiry.packageName;

  if (!slug) {
    throw new AppError('No package linked to this enquiry. Provide packageSlug in the request body.', 400);
  }

  const staff = req.user!;
  const staffName = `${staff.firstName} ${staff.lastName || ''}`.trim();

  await sendBookingLink({
    customerEmail: enquiry.email,
    customerName: `${enquiry.firstName} ${enquiry.lastName || ''}`.trim(),
    packageName: packageName || 'Your Custom Package',
    packageSlug: slug,
    staffName,
    price: req.body.price || pkg?.price,
    departureId: enquiry.departureId?.toString(),
    travelDate: enquiry.travelDate,
    enquiryId: enquiry._id.toString(),
  });

  const finalPrice = req.body.price || pkg?.price;
  enquiry.timeline = enquiry.timeline || [];
  enquiry.timeline.push({
    type: 'booking_link_sent',
    title: `Booking link sent to ${enquiry.email}`,
    description: `Package: ${packageName || 'Custom Package'}${finalPrice ? ` • ₹${Number(finalPrice).toLocaleString('en-IN')}` : ''}`,
    by: req.user!._id,
    byName: staffName,
    date: new Date(),
    meta: { packageSlug: slug, packageName, price: finalPrice },
  });
  await enquiry.save();

  res.status(200).json({
    status: 'success',
    message: `Booking link sent to ${enquiry.email}`,
  });
});

// @desc    Delete enquiry
// @route   DELETE /api/enquiries/:id
export const deleteEnquiry = asyncHandler(async (req: Request, res: Response) => {
  const enquiry = await Enquiry.findByIdAndDelete(req.params.id);

  if (!enquiry) {
    throw new AppError('Enquiry not found', 404);
  }

  res.status(200).json({
    status: 'success',
    message: 'Enquiry deleted successfully',
  });
});

// @desc    Get all enquiries for the currently logged in customer
// @route   GET /api/enquiries/customer/me
export const getCustomerEnquiries = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!._id;

  const enquiries = await Enquiry.find({ user: userId })
    .populate('assignedTo', 'firstName lastName')
    .sort({ createdAt: -1 });

  res.status(200).json({
    status: 'success',
    results: enquiries.length,
    data: enquiries,
  });
});

// @desc    Get specific enquiry for the currently logged in customer
// @route   GET /api/enquiries/customer/me/:id
export const getCustomerEnquiryById = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!._id;

  const enquiry = await Enquiry.findOne({ _id: req.params.id, user: userId })
    .populate('package', 'name slug')
    .populate('bookingRef', 'bookingId bookingStatus paymentStatus paymentFinanceStatus totalAmount paidAmount')
    .populate('assignedTo', 'firstName lastName avatar description phone');

  if (!enquiry) {
    throw new AppError('Enquiry not found', 404);
  }

  res.status(200).json({
    status: 'success',
    data: enquiry,
  });
});

// @desc    Submit feedback for the assigned employee of an enquiry
// @route   POST /api/enquiries/customer/me/:id/feedback
// @access  Customer
export const submitEnquiryFeedback = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!._id;
  const { rating, comments } = req.body;

  if (!rating || rating < 1 || rating > 5) {
    throw new AppError('Please provide a valid rating between 1 and 5', 400);
  }

  const enquiry = await Enquiry.findOne({ _id: req.params.id, user: userId });

  if (!enquiry) {
    throw new AppError('Enquiry not found', 404);
  }

  if (!enquiry.assignedTo) {
    throw new AppError('This enquiry is not assigned to any employee yet', 400);
  }

  enquiry.feedback = {
    rating: Number(rating),
    comments,
    submittedAt: new Date(),
  };

  enquiry.timeline = enquiry.timeline || [];
  enquiry.timeline.push({
    type: 'feedback',
    title: `Customer feedback submitted: ${rating} / 5 ⭐`,
    description: comments ? `"${comments}"` : 'No written comments',
    date: new Date(),
    meta: { rating: Number(rating), comments },
  });

  await enquiry.save();

  res.status(200).json({
    status: 'success',
    message: 'Feedback submitted successfully',
    data: enquiry.feedback,
  });
});

// @desc    Import enquiries via CSV (bulk import with duplicate ID skipping & Meta Ads parser support)
// @route   POST /api/enquiries/import
export const importEnquiries = asyncHandler(async (req: Request, res: Response) => {
  const {
    leads = [],
    defaultAssignedTo,
    defaultChannel,
    defaultSource,
    skipDuplicates = true,
    skipTestLeads = true,
  } = req.body;

  if (!Array.isArray(leads) || leads.length === 0) {
    throw new AppError('No leads provided for import', 400);
  }

  // Pre-fetch assigned staff info if assigned
  let assignedStaffName = 'Staff';
  let assignedStaffId: mongoose.Types.ObjectId | undefined = undefined;
  if (defaultAssignedTo) {
    const staffDoc = await User.findById(defaultAssignedTo).select('firstName lastName email');
    if (staffDoc) {
      assignedStaffId = staffDoc._id;
      assignedStaffName = `${staffDoc.firstName} ${staffDoc.lastName || ''}`.trim();
    }
  }

  const creatorName = req.user ? `${req.user.firstName} ${req.user.lastName || ''}`.trim() : 'Admin';

  // 1. Collect all non-empty externalLeadIds from the incoming batch
  const incomingExternalIds = leads
    .map((l: any) => (l.externalLeadId || l.id || l.leadId || '').toString().trim())
    .filter((id: string) => id.length > 0);

  // 2. Query database for existing externalLeadIds
  let existingExternalIdsSet = new Set<string>();
  if (incomingExternalIds.length > 0) {
    const existingLeadDocs = await Enquiry.find({
      externalLeadId: { $in: incomingExternalIds },
    })
      .select('externalLeadId')
      .lean();

    existingExternalIdsSet = new Set(
      existingLeadDocs.map((doc: any) => doc.externalLeadId?.toString().trim()).filter(Boolean)
    );
  }

  // Also pre-fetch existing phones/emails for duplicate detection if skipDuplicates is enabled
  let existingPhonesSet = new Set<string>();
  let existingEmailsSet = new Set<string>();
  if (skipDuplicates) {
    const incomingPhones = leads
      .map((l: any) => (l.phone || l.phone_number || '').toString().replace(/\D/g, '').slice(-10))
      .filter((p: string) => p.length >= 7);

    const incomingEmails = leads
      .map((l: any) => (l.email || '').toString().toLowerCase().trim())
      .filter((e: string) => e.length > 0 && !e.includes('meta.com'));

    if (incomingPhones.length > 0 || incomingEmails.length > 0) {
      const orConditions: any[] = [];
      if (incomingPhones.length > 0) {
        orConditions.push({ phone: { $in: incomingPhones.map((p: string) => new RegExp(`${p}$`)) } });
      }
      if (incomingEmails.length > 0) {
        orConditions.push({ email: { $in: incomingEmails } });
      }

      if (orConditions.length > 0) {
        const existingContacts = await Enquiry.find({ $or: orConditions })
          .select('phone email')
          .lean();

        existingContacts.forEach((doc: any) => {
          if (doc.phone) {
            const digits = doc.phone.replace(/\D/g, '').slice(-10);
            if (digits) existingPhonesSet.add(digits);
          }
          if (doc.email) {
            existingEmailsSet.add(doc.email.toLowerCase().trim());
          }
        });
      }
    }
  }

  const seenExternalIdsInBatch = new Set<string>();
  const seenPhonesInBatch = new Set<string>();
  const seenEmailsInBatch = new Set<string>();

  let importedCount = 0;
  let duplicatesSkipped = 0;
  let testLeadsSkipped = 0;
  const errorList: { row: number; reason: string; lead?: any }[] = [];
  const createdEnquiries: any[] = [];

  for (let index = 0; index < leads.length; index++) {
    const lead = leads[index];
    const rowNum = index + 1;

    // Check if test lead
    const isTest =
      lead.isTestLead ||
      lead.lead_status === 'test' ||
      (lead.email && lead.email.toLowerCase().includes('test@meta.com')) ||
      (lead.full_name && lead.full_name.includes('<test lead')) ||
      (lead.firstName && lead.firstName.includes('<test lead')) ||
      (lead.phone && lead.phone.includes('<test lead')) ||
      (lead.phone_number && lead.phone_number.includes('<test lead'));

    if (skipTestLeads && isTest) {
      testLeadsSkipped++;
      continue;
    }

    // Resolve external lead ID
    const rawExternalId = (lead.externalLeadId || lead.id || lead.leadId || '').toString().trim();

    // DUPLICATE ID CHECK: If ID already exists in MongoDB, skip row
    if (rawExternalId) {
      if (existingExternalIdsSet.has(rawExternalId) || seenExternalIdsInBatch.has(rawExternalId)) {
        duplicatesSkipped++;
        continue;
      }
      seenExternalIdsInBatch.add(rawExternalId);
    }

    // Clean phone number (strip 'p:' prefix commonly added by Meta Lead Ads)
    let rawPhone = (lead.phone || lead.phone_number || '').toString().trim();
    if (rawPhone.startsWith('p:')) {
      rawPhone = rawPhone.substring(2).trim();
    }
    const phoneDigits = rawPhone.replace(/\D/g, '').slice(-10);

    // Duplicate check by phone or email
    if (skipDuplicates) {
      const emailLower = (lead.email || '').toString().toLowerCase().trim();
      if (phoneDigits && (existingPhonesSet.has(phoneDigits) || seenPhonesInBatch.has(phoneDigits))) {
        duplicatesSkipped++;
        continue;
      }
      if (emailLower && emailLower !== 'test@meta.com' && (existingEmailsSet.has(emailLower) || seenEmailsInBatch.has(emailLower))) {
        duplicatesSkipped++;
        continue;
      }

      if (phoneDigits) seenPhonesInBatch.add(phoneDigits);
      if (emailLower) seenEmailsInBatch.add(emailLower);
    }

    // Extract names
    let firstName = (lead.firstName || '').toString().trim();
    let lastName = (lead.lastName || '').toString().trim();

    if (!firstName && (lead.full_name || lead.name)) {
      const fullName = (lead.full_name || lead.name).toString().trim();
      const parts = fullName.split(/\s+/);
      firstName = parts[0] || '';
      lastName = parts.slice(1).join(' ') || '';
    }

    // Validate minimum requirements
    if (!firstName && !rawPhone) {
      errorList.push({ row: rowNum, reason: 'Missing both name and phone number', lead });
      continue;
    }

    if (!firstName) {
      firstName = rawPhone ? `Lead ${rawPhone.slice(-4)}` : 'Valued Customer';
    }

    if (!rawPhone) {
      errorList.push({ row: rowNum, reason: 'Missing phone number', lead });
      continue;
    }

    // Ensure email is valid and present (schema requirement)
    let email = (lead.email || '').toString().trim().toLowerCase();
    if (!email || !email.includes('@')) {
      const safeId = rawExternalId ? rawExternalId.replace(/[^a-zA-Z0-9]/g, '') : phoneDigits;
      email = `lead_${safeId || Date.now()}@imported.letslivetours.com`;
    }

    // Destination formatting
    let destination = (
      lead.destination ||
      lead['which_destination_are_you_interested_in?'] ||
      lead.which_destination_are_you_interested_in ||
      ''
    ).toString().trim();

    if (destination === 'not_decided_yet') {
      destination = 'Not Decided Yet';
    } else if (destination.length > 0 && !destination.includes('<test')) {
      // Capitalize words in slug (e.g., "rajasthan" -> "Rajasthan")
      destination = destination
        .split(/[_\s]+/)
        .map((w: string) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
        .join(' ');
    } else if (destination.includes('<test')) {
      destination = '';
    }

    // Determine platform / source / channel
    const platformRaw = (lead.platform || lead.source || lead.channel || '').toString().toLowerCase().trim();
    let resolvedSource: 'website' | 'whatsapp' | 'phone' | 'walk-in' | 'instagram' | 'facebook' | 'google' | 'referral' | 'other' = 'other';
    let resolvedChannel = defaultChannel || 'other';

    if (platformRaw === 'ig' || platformRaw.includes('instagram')) {
      resolvedSource = 'instagram';
      resolvedChannel = 'instagram';
    } else if (platformRaw === 'fb' || platformRaw.includes('facebook')) {
      resolvedSource = 'facebook';
      resolvedChannel = 'facebook';
    } else if (platformRaw.includes('google')) {
      resolvedSource = 'google';
      resolvedChannel = 'google';
    } else if (platformRaw.includes('website')) {
      resolvedSource = 'website';
      resolvedChannel = 'website';
    } else if (platformRaw.includes('whatsapp')) {
      resolvedSource = 'whatsapp';
      resolvedChannel = 'whatsapp';
    } else if (defaultSource && ['website', 'whatsapp', 'phone', 'walk-in', 'instagram', 'facebook', 'google', 'referral', 'other'].includes(defaultSource)) {
      resolvedSource = defaultSource as any;
    }

    // Campaign details and tags
    const campaignName = (lead.campaign_name || lead.campaignName || '').toString().trim();
    const adName = (lead.ad_name || lead.adName || '').toString().trim();
    const formName = (lead.form_name || lead.formName || '').toString().trim();
    const state = (lead.state || '').toString().trim();

    const tags: string[] = Array.isArray(lead.tags) ? [...lead.tags] : [];
    tags.push('csv-import');
    if (resolvedChannel) tags.push(resolvedChannel);
    if (campaignName && !tags.includes(campaignName)) tags.push(campaignName);
    if (formName && !tags.includes(formName)) tags.push(formName);

    // Build message
    const messageParts: string[] = [];
    if (lead.message) messageParts.push(lead.message);
    if (campaignName) messageParts.push(`Campaign: ${campaignName}`);
    if (adName) messageParts.push(`Ad: ${adName}`);
    if (formName) messageParts.push(`Form: ${formName}`);
    if (state && !state.includes('<test')) messageParts.push(`State: ${state}`);
    const message = messageParts.join(' | ');

    // Timeline creation
    const timeline: any[] = [
      {
        type: 'acquisition',
        title: `Lead imported via CSV (${resolvedChannel})`,
        description: `Ingested by ${creatorName}${campaignName ? ` • Campaign: ${campaignName}` : ''}${rawExternalId ? ` • Lead ID: ${rawExternalId}` : ''}`,
        by: req.user?._id,
        byName: creatorName,
        date: lead.created_time ? new Date(lead.created_time) : new Date(),
        meta: {
          externalLeadId: rawExternalId || undefined,
          campaignName: campaignName || undefined,
          adName: adName || undefined,
          formName: formName || undefined,
          source: resolvedSource,
          channel: resolvedChannel,
          platform: lead.platform,
        },
      },
    ];

    if (destination) {
      timeline.push({
        type: 'requirements',
        title: 'Trip interest recorded',
        description: `Destination: ${destination}`,
        by: req.user?._id,
        byName: creatorName,
        date: new Date(Date.now() + 100),
        meta: { destination },
      });
    }

    if (assignedStaffId) {
      timeline.push({
        type: 'assignment',
        title: `Assigned to ${assignedStaffName}`,
        description: `Assigned during CSV bulk import by ${creatorName}`,
        by: req.user?._id,
        byName: creatorName,
        date: new Date(Date.now() + 200),
      });
    }

    try {
      const newEnquiry = await Enquiry.create({
        firstName,
        lastName: lastName || undefined,
        email,
        phone: rawPhone,
        destination: destination || undefined,
        message: message || undefined,
        source: resolvedSource,
        channel: resolvedChannel,
        status: assignedStaffId ? 'assigned' : 'new',
        priority: 'medium',
        assignedTo: assignedStaffId,
        externalLeadId: rawExternalId || undefined,
        tags: Array.from(new Set(tags)),
        timeline,
        createdAt: lead.created_time && !isNaN(new Date(lead.created_time).getTime()) ? new Date(lead.created_time) : new Date(),
      });

      importedCount++;
      createdEnquiries.push(newEnquiry._id);
    } catch (err: any) {
      errorList.push({
        row: rowNum,
        reason: err.message || 'Failed to save lead to database',
        lead: { firstName, phone: rawPhone, email },
      });
    }
  }

  // Activity log for audit trail
  if (importedCount > 0) {
    logActivity({
      req,
      action: 'create',
      entity: 'enquiry',
      description: `Imported ${importedCount} leads via CSV (${duplicatesSkipped} duplicates skipped, ${testLeadsSkipped} test leads skipped)`,
      meta: {
        total: leads.length,
        importedCount,
        duplicatesSkipped,
        testLeadsSkipped,
        errorCount: errorList.length,
        assignedTo: defaultAssignedTo,
      },
    }).catch(console.error);
  }

  res.status(200).json({
    status: 'success',
    data: {
      total: leads.length,
      imported: importedCount,
      duplicatesSkipped,
      testLeadsSkipped,
      errors: errorList,
    },
  });
});
