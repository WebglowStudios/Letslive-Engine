import { Router } from 'express';
import {
  getDashboardStats,
  getStaff,
  createStaff,
  updateStaff,
  deleteStaff,
} from '../controllers/adminController.js';
import { protect, requirePermission } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { Request, Response } from 'express';
import ActivityLog from '../models/ActivityLog.js';

const router = Router();

// All admin routes require authentication
router.use(protect);

// Dashboard stats — accessible by all staff+
router.get('/stats', requirePermission('dashboard.view'), getDashboardStats);

// Staff management — admin only for sensitive roles, manager can create customers
router.get('/staff', requirePermission('staff.view'), getStaff);
router.post('/staff', protect, requirePermission('staff.create'), createStaff);
router.put('/staff/:id', requirePermission('staff.edit'), updateStaff);
router.delete('/staff/:id', requirePermission('staff.delete'), deleteStaff);


// Activity log — staff+
router.get('/activity', requirePermission('activity.view'), asyncHandler(async (req: Request, res: Response) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 50;
  const skip = (page - 1) * limit;

  const filter: Record<string, unknown> = {};
  if (req.query.action) filter.action = req.query.action;
  if (req.query.entity) filter.entity = req.query.entity;
  if (req.query.user) filter.user = req.query.user;

  // userType=staff → only admin/manager/staff/guest roles
  // userType=user  → only customer (role: 'user') entries
  if (req.query.userType === 'user') {
    filter.userRole = 'user';
  } else if (req.query.userType === 'staff') {
    filter.userRole = { $in: ['admin', 'manager', 'sales-manager', 'ops-manager', 'sales-staff', 'ops-staff', 'staff', 'guest'] };
  }

  const [logs, total] = await Promise.all([
    ActivityLog.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    ActivityLog.countDocuments(filter),
  ]);

  res.status(200).json({
    status: 'success',
    results: logs.length,
    total,
    page,
    pages: Math.ceil(total / limit),
    data: logs,
  });
}));

export default router;
