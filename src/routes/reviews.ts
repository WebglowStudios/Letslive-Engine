import { Router } from 'express';
import {
  getReviewsByPackage,
  getReviewsByDestination,
  createReview,
  updateReview,
  deleteReview,
  approveReview,
} from '../controllers/reviewController.js';
import { protect, adminOnly } from '../middleware/auth.js';

const router = Router();

router.get('/package/:packageId', getReviewsByPackage);
router.get('/destination/:destId', getReviewsByDestination);
router.post('/', protect, createReview);
router.put('/:id', protect, updateReview);
router.delete('/:id', protect, deleteReview);
router.put('/:id/approve', protect, adminOnly, approveReview);

export default router;
