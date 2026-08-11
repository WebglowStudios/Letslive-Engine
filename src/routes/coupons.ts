import express from 'express';
import {
  createCoupon,
  getCoupons,
  getCoupon,
  updateCoupon,
  deleteCoupon,
  validateCoupon
} from '../controllers/couponController.js';
import { protect, roleCheck } from '../middleware/auth.js';

const router = express.Router();

// Public route for checkout validation
router.post('/validate', validateCoupon);

// Admin-only routes for management
router.use(protect);
router.use(roleCheck('admin', 'super-admin')); // adjust roles if necessary

router.route('/')
  .get(getCoupons)
  .post(createCoupon);

router.route('/:id')
  .get(getCoupon)
  .put(updateCoupon)
  .delete(deleteCoupon);

export default router;
