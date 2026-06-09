import { Router } from 'express';
import {
  createBooking,
  getUserBookings,
  getBookingById,
  cancelBooking,
  getAllBookings,
  updateBookingStatus,
} from '../controllers/bookingController.js';
import { protect, adminOnly, staffOnly } from '../middleware/auth.js';

const router = Router();

router.post('/', protect, createBooking);
router.get('/', protect, getUserBookings);
router.get('/all', protect, staffOnly, getAllBookings);
router.get('/:id', protect, getBookingById);
router.put('/:id/cancel', protect, cancelBooking);
router.put('/:id/status', protect, staffOnly, updateBookingStatus);

export default router;
