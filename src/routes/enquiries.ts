import { Router } from 'express';
import {
  createEnquiry,
  getAllEnquiries,
  getEnquiryById,
  updateEnquiry,
} from '../controllers/enquiryController.js';
import { protect, adminOnly } from '../middleware/auth.js';
import { enquiryLimiter } from '../middleware/rateLimiter.js';

const router = Router();

router.post('/', enquiryLimiter, createEnquiry);
router.get('/', protect, adminOnly, getAllEnquiries);
router.get('/:id', protect, adminOnly, getEnquiryById);
router.put('/:id', protect, adminOnly, updateEnquiry);

export default router;
