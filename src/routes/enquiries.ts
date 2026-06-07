import { Router } from 'express';
import {
  createEnquiry,
  getAllEnquiries,
  getMyEnquiries,
  getEnquiryById,
  updateEnquiry,
} from '../controllers/enquiryController.js';
import { protect, managerOnly, staffOnly } from '../middleware/auth.js';
import { enquiryLimiter } from '../middleware/rateLimiter.js';

const router = Router();

// Public — create enquiry (auto-assigned via round-robin)
router.post('/', enquiryLimiter, createEnquiry);

// Staff — get only my assigned enquiries
router.get('/mine', protect, staffOnly, getMyEnquiries);

// Admin/Manager — get ALL enquiries
router.get('/', protect, managerOnly, getAllEnquiries);

// Staff+ — get/update single enquiry (staff can only access their own)
router.get('/:id', protect, staffOnly, getEnquiryById);
router.put('/:id', protect, staffOnly, updateEnquiry);

export default router;
