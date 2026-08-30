import express, { Request, Response, NextFunction } from 'express';
import { getApprovals, approveRequest, rejectRequest } from '../controllers/approvalController.js';
import { protect, adminOnly } from '../middleware/auth.js';

const router = express.Router();

router.use(protect);

const canViewApprovals = (req: Request, res: Response, next: NextFunction) => {
  if (req.user && ['admin', 'manager', 'senior-manager', 'ops-manager', 'sales-manager'].includes(req.user.role)) {
    return next();
  }
  res.status(403).json({ message: 'Not authorized to view approvals' });
};

// Managers and Admins can view approvals
router.get('/', canViewApprovals, getApprovals);

// Only admins can approve or reject
router.put('/:id/approve', adminOnly, approveRequest);
router.put('/:id/reject', adminOnly, rejectRequest);

export default router;
