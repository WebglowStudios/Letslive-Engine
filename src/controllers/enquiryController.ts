import { Request, Response } from 'express';
import Enquiry from '../models/Enquiry.js';
import User from '../models/User.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { AppError } from '../middleware/errorHandler.js';
import { sendEnquiryReceived, sendCallbackRequested, sendAdminNewEnquiry, sendStaffEnquiryAssigned } from '../services/emailService.js';

// Round-robin counter stored in memory (resets on server restart — acceptable for dev)
let roundRobinIndex = 0;

// Get the next staff member for assignment
async function getNextStaffMember(): Promise<string | undefined> {
  const staffMembers = await User.find({
    role: { $in: ['staff', 'manager'] },
    isVerified: true,
  }).sort({ createdAt: 1 });

  if (staffMembers.length === 0) return undefined;

  const assigned = staffMembers[roundRobinIndex % staffMembers.length];
  roundRobinIndex = (roundRobinIndex + 1) % staffMembers.length;
  return String(assigned._id);
}

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

// @desc    Create an enquiry (public — auto-assigns via round-robin)
// @route   POST /api/enquiries
export const createEnquiry = asyncHandler(async (req: Request, res: Response) => {
  // Auto-assign to next staff member
  const assignedToId = await getNextStaffMember();

  // Auto-determine priority
  const priority = determinePriority(req.body.type || 'general', req.body.travelDate);

  const enquiry = await Enquiry.create({
    ...req.body,
    assignedTo: assignedToId || undefined,
    status: assignedToId ? 'assigned' : 'new',
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

  // Admin notification
  sendAdminNewEnquiry(customerName, customerEmail, type, req.body.packageName).catch(console.error);

  // Staff notification (if assigned)
  if (assignedToId) {
    const staffMember = await User.findById(assignedToId);
    if (staffMember) {
      sendStaffEnquiryAssigned(staffMember.email, staffMember.firstName, customerName, type, req.body.packageName).catch(console.error);
    }
  }

  res.status(201).json({
    status: 'success',
    data: enquiry,
  });
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

  const [enquiries, total] = await Promise.all([
    Enquiry.find(filter)
      .populate('assignedTo', 'firstName lastName')
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
    .populate('assignedTo', 'firstName lastName')
    .populate('notes.by', 'firstName lastName');

  if (!enquiry) {
    throw new AppError('Enquiry not found', 404);
  }

  // Staff can only view their own assigned enquiries
  const user = req.user!;
  if (user.role === 'staff' && enquiry.assignedTo?.toString() !== user._id.toString()) {
    throw new AppError('Access denied', 403);
  }

  res.status(200).json({
    status: 'success',
    data: enquiry,
  });
});

// @desc    Update enquiry (status, notes, reassign)
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

  if (req.body.status) enquiry.status = req.body.status;
  if (req.body.priority) enquiry.priority = req.body.priority;
  if (req.body.assignedTo) {
    enquiry.assignedTo = req.body.assignedTo;
    if (enquiry.status === 'new') enquiry.status = 'assigned';
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

  const updated = await Enquiry.findById(enquiry._id)
    .populate('assignedTo', 'firstName lastName')
    .populate('notes.by', 'firstName lastName');

  res.status(200).json({
    status: 'success',
    data: updated,
  });
});
