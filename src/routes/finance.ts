import express from 'express';
import { protect, adminOnly } from '../middleware/auth.js';
import { getPendingApprovals, processApproval } from '../controllers/financeController.js';

const router = express.Router();

router.use(protect);
// Restrict all finance routes to admin
router.use(adminOnly);

router.get('/approvals', getPendingApprovals);
router.post('/approvals/:type/:id', processApproval);

export default router;
