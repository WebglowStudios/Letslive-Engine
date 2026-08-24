import { Router } from 'express';
import {
  createBooking,
  getUserBookings,
  getBookingById,
  cancelBooking,
  getAllBookings,
  updateBookingStatus,
  updateBookingDates,
  updateBookingPassengers,
} from '../controllers/bookingController.js';
import { protect, requirePermission, managerOnly } from '../middleware/auth.js';

const router = Router();

router.post('/', protect, createBooking);
router.get('/', protect, getUserBookings);
router.get('/all', protect, requirePermission('bookings.view'), getAllBookings);
router.get('/:id', protect, getBookingById);
router.put('/:id/cancel', protect, cancelBooking);
router.put('/:id/status', protect, requirePermission('bookings.update'), updateBookingStatus);
router.put('/:id/dates', protect, managerOnly, updateBookingDates);
router.put('/:id/passengers', protect, requirePermission('bookings.update'), updateBookingPassengers);

export default router;
