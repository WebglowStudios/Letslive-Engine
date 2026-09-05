import { Request, Response } from 'express';
import { asyncHandler } from '../middleware/asyncHandler.js';
import ApprovalRequest from '../models/ApprovalRequest.js';
import Package from '../models/Package.js';
import Destination from '../models/Destination.js';
import { AppError } from '../middleware/errorHandler.js';
import { logActivity } from '../utils/logActivity.js';

// @desc    Get all pending approvals
// @route   GET /api/approvals
export const getApprovals = asyncHandler(async (req: Request, res: Response) => {
  const { status = 'pending' } = req.query;
  const approvals = await ApprovalRequest.find({ status: status as 'pending' | 'approved' | 'rejected' })
    .populate('requestedBy', 'firstName lastName email avatar role')
    .populate('entityId')
    .sort({ createdAt: -1 });

  res.status(200).json({
    status: 'success',
    results: approvals.length,
    data: approvals,
  });
});

// @desc    Approve a request
// @route   PUT /api/approvals/:id/approve
export const approveRequest = asyncHandler(async (req: Request, res: Response) => {
  const approval = await ApprovalRequest.findById(req.params.id);
  if (!approval) {
    throw new AppError('Approval request not found', 404);
  }

  if (approval.status !== 'pending') {
    throw new AppError('This request has already been processed', 400);
  }

  const { entityType, entityId, action, payload } = approval;

  try {
    let resultEntity;

    if (action === 'create') {
      payload.approvalStatus = 'approved';
      if (entityType === 'Package') resultEntity = await Package.create(payload);
      else resultEntity = await Destination.create(payload);
    } else if (action === 'update') {
      if (!entityId) throw new AppError('Missing entityId for update action', 400);
      payload.approvalStatus = 'approved';
      if (entityType === 'Package') {
        resultEntity = await Package.findByIdAndUpdate(entityId.toString(), payload, { new: true, runValidators: true });
      } else {
        resultEntity = await Destination.findByIdAndUpdate(entityId.toString(), payload, { new: true, runValidators: true });
      }
      if (!resultEntity) throw new AppError(`${entityType} not found`, 404);
    } else if (action === 'delete') {
      if (!entityId) throw new AppError('Missing entityId for delete action', 400);
      if (entityType === 'Package') {
        resultEntity = await Package.findByIdAndDelete(entityId.toString());
      } else {
        resultEntity = await Destination.findByIdAndDelete(entityId.toString());
      }
      if (!resultEntity) throw new AppError(`${entityType} not found`, 404);
    }

    approval.status = 'approved';
    if (req.user) approval.reviewedBy = req.user._id;
    await approval.save();

    await logActivity({
      req,
      action: 'update',
      entity: 'other',
      entityId: String(approval._id),
      entityName: `${action} ${entityType}`,
      description: `Approved ${action} request for ${entityType}`,
    });

    res.status(200).json({
      status: 'success',
      data: resultEntity,
    });
  } catch (error: any) {
    throw new AppError(`Failed to apply changes: ${error.message}`, 400);
  }
});

// @desc    Reject a request
// @route   PUT /api/approvals/:id/reject
export const rejectRequest = asyncHandler(async (req: Request, res: Response) => {
  const { reviewNotes } = req.body;
  const approval = await ApprovalRequest.findById(req.params.id);

  if (!approval) {
    throw new AppError('Approval request not found', 404);
  }

  if (approval.status !== 'pending') {
    throw new AppError('This request has already been processed', 400);
  }

  approval.status = 'rejected';
  if (req.user) approval.reviewedBy = req.user._id;
  if (reviewNotes) approval.reviewNotes = reviewNotes;
  
  await approval.save();

  await logActivity({
    req,
    action: 'update',
    entity: 'other',
    entityId: String(approval._id),
    entityName: `${approval.action} ${approval.entityType}`,
    description: `Rejected ${approval.action} request for ${approval.entityType}`,
  });

  res.status(200).json({
    status: 'success',
    data: approval,
  });
});
