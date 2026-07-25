import { Router } from 'express';
import { createOrder, verifyPayment, getPaymentConfig } from '../controllers/paymentController.js';
import { protect } from '../middleware/auth.js';

const router = Router();

// Public — frontend fetches this before showing the booking form
router.get('/config/:packageId', getPaymentConfig);

// Protected — requires login
router.post('/create-order', protect, createOrder);
router.post('/verify', protect, verifyPayment);

export default router;
