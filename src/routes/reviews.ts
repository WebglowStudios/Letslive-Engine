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
  createManualReview,
  getAdminReviewsByPackage,
} from '../controllers/reviewController.js';
import { protect, requirePermission } from '../middleware/auth.js';

const router = Router();

router.get('/featured', getFeaturedReviews);
router.get('/me', protect, getMyReviews);
router.get('/can-review/:packageId', protect, canReviewPackage);
router.get('/package/:packageId', getReviewsByPackage);
router.get('/destination/:destId', getReviewsByDestination);
router.get('/admin/package/:packageId', protect, requirePermission('reviews.view'), getAdminReviewsByPackage);
router.post('/manual', protect, requirePermission('reviews.edit'), createManualReview);
router.post('/', protect, createReview);
router.put('/:id', protect, updateReview);
router.delete('/:id', protect, requirePermission('reviews.delete'), deleteReview);
router.put('/:id/approve', protect, requirePermission('reviews.approve'), approveReview);

export default router;
