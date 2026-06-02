import { Router } from 'express';
import {
  getDashboardStats,
  getStaff,
  createStaff,
  updateStaff,
  deleteStaff,
} from '../controllers/adminController.js';
import { protect, adminOnly, staffOnly } from '../middleware/auth.js';

const router = Router();

// All admin routes require authentication
router.use(protect);

// Dashboard stats — accessible by all staff+
router.get('/stats', staffOnly, getDashboardStats);

// Staff management — admin only
router.get('/staff', adminOnly, getStaff);
router.post('/staff', adminOnly, createStaff);
router.put('/staff/:id', adminOnly, updateStaff);
router.delete('/staff/:id', adminOnly, deleteStaff);

export default router;
