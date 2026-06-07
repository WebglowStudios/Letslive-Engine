import { Router } from 'express';
import {
  getFeaturedReviews,
  getReviewsByPackage,
  getReviewsByDestination,
  getMyReviews,
  createReview,
  updateReview,
  deleteReview,
  approveReview,
  canReviewPackage,
} from '../controllers/reviewController.js';
import { protect, adminOnly } from '../middleware/auth.js';

const router = Router();

router.get('/featured', getFeaturedReviews);
router.get('/me', protect, getMyReviews);
router.get('/can-review/:packageId', protect, canReviewPackage);
router.get('/package/:packageId', getReviewsByPackage);
router.get('/destination/:destId', getReviewsByDestination);
router.post('/', protect, createReview);
router.put('/:id', protect, updateReview);
router.delete('/:id', protect, deleteReview);
router.put('/:id/approve', protect, adminOnly, approveReview);

export default router;
