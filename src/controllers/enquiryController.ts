import { Request, Response } from 'express';
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

  const existingUser = await User.findOne({ email: req.body.email?.toLowerCase().trim() });

  const enquiry = await Enquiry.create({
    ...req.body,
    user: existingUser ? existingUser._id : undefined,
    assignedTo: undefined,   // always unassigned — admin will assign manually
    status: 'new',
    priority,
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
    tags, channel, assignedTo, priority: manualPriority,
  } = req.body;

  if (!firstName || !email || !phone) {
    throw new AppError('firstName, email and phone are required', 400);
  }

  // Allow manual assignedTo — if not provided, stays 'new' and unassigned
  const assignedToId = assignedTo || undefined;
  const priority = manualPriority || determinePriority(type || 'general', travelDate);

  const existingUser = await User.findOne({ email: email?.toLowerCase().trim() });

  const enquiry = await Enquiry.create({
    firstName, lastName, email, phone,
    type: type || 'general',
    message,
    packageName,
    destination,
    travelDate,
    travellerCount,
    budget,
    tags: tags || [],
    channel: channel || 'phone',
    source: (['whatsapp', 'website', 'instagram', 'google', 'referral', 'walk-in', 'other'].includes(channel))
      ? channel
      : 'phone',
    assignedTo: assignedToId || undefined,
    user: existingUser ? existingUser._id : undefined,
    status: assignedToId ? 'assigned' : 'new',
    priority,
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
  if (req.query.status) filter.status = req.query.status;

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
  if (req.query.status) filter.status = req.query.status;
  if (req.query.type) filter.type = req.query.type;
  if (req.query.assignedTo) filter.assignedTo = req.query.assignedTo;
  if (req.query.priority) filter.priority = req.query.priority;
  if (req.query.channel) filter.channel = req.query.channel;

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

  // Date range filter
  if (req.query.from || req.query.to) {
    const dateFilter: Record<string, Date> = {};
    if (req.query.from) dateFilter.$gte = new Date(req.query.from as string);
    if (req.query.to) dateFilter.$lte = new Date(req.query.to as string);
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
    .populate('package', 'name')
    .populate('assignedTo', 'firstName lastName email')
    .populate('notes.by', 'firstName lastName')
    .populate('callLog.by', 'firstName lastName')
    .populate('bookingRef', 'bookingId totalAmount');

  if (!enquiry) {
    throw new AppError('Enquiry not found', 404);
  }

  // Staff can only view their own assigned enquiries
  const user = req.user!;
  if (user.role === 'staff' && enquiry.assignedTo?.toString() !== user._id.toString()) {
    throw new AppError('Access denied', 403);
  }

  // Fetch all packages linked to this enquiry
  const linkedItineraries = await Package.find({ enquiryId: enquiry._id })
    .select('_id name slug price')
    .lean();

  res.status(200).json({
    status: 'success',
    data: {
      ...enquiry.toJSON(),
      linkedItineraries,
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

  // Staff can only update their own assigned enquiries
  const user = req.user!;
  if (user.role === 'staff' && enquiry.assignedTo?.toString() !== user._id.toString()) {
    throw new AppError('Access denied. This enquiry is not assigned to you.', 403);
  }

  const prevStatus = enquiry.status;

  // ── Contact / identity fields ──────────────────────────────────────────────
  if (req.body.firstName !== undefined) enquiry.firstName = req.body.firstName;
  if (req.body.lastName  !== undefined) enquiry.lastName  = req.body.lastName;
  if (req.body.email     !== undefined) enquiry.email     = req.body.email;
  if (req.body.phone     !== undefined) enquiry.phone     = req.body.phone;
  if (req.body.destination   !== undefined) enquiry.destination   = req.body.destination;
  if (req.body.travelDate    !== undefined) enquiry.travelDate    = req.body.travelDate ? new Date(req.body.travelDate) : undefined;
  if (req.body.packageName   !== undefined) enquiry.packageName   = req.body.packageName;
  if (req.body.source        !== undefined) enquiry.source        = req.body.source;

  // ── Sync contact changes to linked User account (if one exists) ────────────
  const hasContactChange = ['firstName', 'lastName', 'email', 'phone'].some(
    (f) => req.body[f] !== undefined
  );
  if (hasContactChange && enquiry.user) {
    const userUpdate: Record<string, string> = {};
    if (req.body.firstName !== undefined) userUpdate.firstName = req.body.firstName;
    if (req.body.lastName  !== undefined) userUpdate.lastName  = req.body.lastName || '';
    if (req.body.email     !== undefined) userUpdate.email     = req.body.email.toLowerCase().trim();
    if (req.body.phone     !== undefined) userUpdate.phone     = req.body.phone;
    await User.findByIdAndUpdate(enquiry.user, userUpdate).catch(console.error);
  }

  if (req.body.status) enquiry.status = req.body.status;
  if (req.body.priority) enquiry.priority = req.body.priority;
  if (req.body.followUpDate !== undefined) {
    enquiry.followUpDate = req.body.followUpDate ? new Date(req.body.followUpDate) : undefined;
    
    // Automatically log this as a note on the timeline for visibility
    if (req.body.followUpDate) {
      const fDate = new Date(req.body.followUpDate).toLocaleDateString('en-IN');
      const fNotes = req.body.followUpNotes ? ` (Notes: ${req.body.followUpNotes})` : '';
      enquiry.notes.push({
        text: `Scheduled follow-up for ${fDate}${fNotes}`,
        by: req.user!._id,
        date: new Date(),
      });
    }
  }
  if (req.body.followUpNotes !== undefined) enquiry.followUpNotes = req.body.followUpNotes;
  if (req.body.travellerCount !== undefined) enquiry.travellerCount = req.body.travellerCount;
  if (req.body.budget !== undefined) enquiry.budget = req.body.budget;
  if (req.body.tags !== undefined) enquiry.tags = req.body.tags;
  if (req.body.channel !== undefined) enquiry.channel = req.body.channel;
  if (req.body.assignedTo) {
    enquiry.assignedTo = req.body.assignedTo;
    if (enquiry.status === 'new') enquiry.status = 'assigned';

    // Notify the newly assigned staff member (fire-and-forget)
    User.findById(req.body.assignedTo).then((staffMember) => {
      if (staffMember) {
        sendStaffEnquiryAssigned(
          staffMember.email,
          staffMember.firstName,
          `${enquiry.firstName} ${enquiry.lastName || ''}`.trim(),
          enquiry.type,
          enquiry.packageName,
        ).catch(console.error);
      }
    }).catch(console.error);
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
    .populate('callLog.by', 'firstName lastName');

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
  if (user.role === 'staff' && enquiry.assignedTo?.toString() !== user._id.toString()) {
    throw new AppError('Access denied', 403);
  }

  const { outcome, notes, duration } = req.body;
  if (!outcome) throw new AppError('outcome is required', 400);

  // Push call log entry
  enquiry.callLog.push({
    attemptedAt: new Date(),
    outcome,
    notes: notes || undefined,
    by: req.user!._id,
    duration: duration || undefined,
  });

  const prevDnp = enquiry.dnpCount;

  // DNP logic: increment counter and move to follow-up
  if (outcome === 'dnp') {
    enquiry.dnpCount = (enquiry.dnpCount || 0) + 1;
    if (enquiry.status === 'assigned' || enquiry.status === 'in-progress') {
      enquiry.status = 'follow-up';
    }
  }

  // Answered: record contact time, move back from follow-up to in-progress
  if (outcome === 'answered') {
    enquiry.lastContactedAt = new Date();
    if (enquiry.status === 'follow-up') {
      enquiry.status = 'in-progress';
    }
  }

  await enquiry.save();

  // Log activity
  await logActivity({
    req,
    action: 'other',
    entity: 'enquiry',
    entityId: String(enquiry._id),
    entityName: `${enquiry.firstName} ${enquiry.lastName || ''}`.trim(),
    description: `Call logged for ${enquiry.firstName}: ${outcome}${notes ? ` — "${notes}"` : ''}`,
    meta: { outcome, dnpCount: enquiry.dnpCount, duration },
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
    .populate('notes.by', 'firstName lastName');

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

  let updateOp: Record<string, unknown> = {};

  if (action === 'reassign') {
    if (!payload?.assignedTo) throw new AppError('payload.assignedTo is required for reassign', 400);
    updateOp = { assignedTo: payload.assignedTo, status: 'assigned' };
  } else if (action === 'close') {
    updateOp = { status: 'closed', lostReason: payload?.lostReason || 'other' };
  } else if (action === 'mark-follow-up') {
    updateOp = { status: 'follow-up', followUpDate: payload?.followUpDate ? new Date(payload.followUpDate) : undefined };
  } else {
    throw new AppError('Invalid action. Use: reassign | close | mark-follow-up', 400);
  }

  const result = await Enquiry.updateMany({ _id: { $in: ids } }, { $set: updateOp });

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

  const dateFilter = { createdAt: { $gte: fromDate, $lte: toDate } };

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
  if (req.user!.role === 'staff') {
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
  if (req.query.status) filter.status = req.query.status;
  if (req.query.assignedTo) filter.assignedTo = req.query.assignedTo;
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
  });

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
    .populate('assignedTo', 'firstName lastName avatar');

  if (!enquiry) {
    throw new AppError('Enquiry not found', 404);
  }

  res.status(200).json({
    status: 'success',
    data: enquiry,
  });
});
