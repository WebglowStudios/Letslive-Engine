import express from 'express';
import {
  createCoupon,
  getCoupons,
  getCoupon,
  updateCoupon,
  deleteCoupon,
  validateCoupon
} from '../controllers/couponController';
import { protect, restrictTo } from '../middleware/authMiddleware';

const router = express.Router();

// Public route for checkout validation
router.post('/validate', validateCoupon);

// Admin-only routes for management
router.use(protect);
router.use(restrictTo('admin', 'super-admin')); // adjust roles if necessary

router.route('/')
  .get(getCoupons)
  .post(createCoupon);

router.route('/:id')
  .get(getCoupon)
  .put(updateCoupon)
  .delete(deleteCoupon);

export default router;
