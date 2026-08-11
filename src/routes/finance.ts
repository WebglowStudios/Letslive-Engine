import express from 'express';
import { protect, restrictTo } from '../middleware/auth.js';
import { getPendingApprovals, processApproval } from '../controllers/financeController.js';

const router = express.Router();

router.use(protect);
// Restrict all finance routes to admin or users with specific finance permission
router.use(restrictTo('admin', 'finance.approve'));

router.get('/approvals', getPendingApprovals);
router.post('/approvals/:type/:id', processApproval);

export default router;
