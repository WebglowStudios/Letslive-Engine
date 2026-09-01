import { Router } from 'express';
import {
  register,
  login,
  logout,
  getMe,
  refreshTokenHandler,
  forgotPassword,
  resetPassword,
  verifyEmail,
} from '../controllers/authController.js';
import { protect } from '../middleware/auth.js';
import { authLimiter } from '../middleware/rateLimiter.js';

const router = Router();

router.post('/register', register);
router.post('/login', authLimiter, login);
router.post('/logout', protect, logout);
router.get('/me', protect, getMe);
router.post('/refresh', refreshTokenHandler);
router.post('/forgot-password', authLimiter, forgotPassword);
router.post('/reset-password/:token', resetPassword);
router.get('/verify-email/:token', verifyEmail);

export default router;
