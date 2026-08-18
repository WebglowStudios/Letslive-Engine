import { Router } from 'express';
import { createOrder, verifyPayment, getPaymentConfig, generatePaymentLink } from '../controllers/paymentController.js';
import { protect } from '../middleware/auth.js';

const router = Router();

// Public — frontend fetches this before showing the booking form
router.get('/config/:packageId', getPaymentConfig);

// Protected — requires login
router.post('/create-order', protect, createOrder);
router.post('/verify', protect, verifyPayment);

// Admin / Staff only (assuming protect allows staff, else restrictTo('admin', 'staff'))
// For now using `protect` as per existing structure
router.post('/create-link', protect, generatePaymentLink);

export default router;
