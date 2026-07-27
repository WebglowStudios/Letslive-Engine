import { Router } from 'express';
import {
  createEnquiry,
  manualCreateEnquiry,
  getAllEnquiries,
  getMyEnquiries,
  getEnquiryById,
  updateEnquiry,
  logCall,
  bulkUpdateEnquiries,
  getEnquiryStats,
  getFollowUpsToday,
  exportEnquiries,
  sendBookingLinkHandler,
  deleteEnquiry,
} from '../controllers/enquiryController.js';

import { protect, managerOnly, staffOnly } from '../middleware/auth.js';
import { enquiryLimiter } from '../middleware/rateLimiter.js';

const router = Router();

// ─── Public ──────────────────────────────────────────────────────────────────
// Public: create enquiry from website (rate-limited, auto-assigns via round-robin)
router.post('/', enquiryLimiter, createEnquiry);

// ─── Staff+ (auth required) ───────────────────────────────────────────────────
// Manually create a walk-in / phone / WhatsApp lead
router.post('/manual', protect, staffOnly, manualCreateEnquiry);

// Get my assigned enquiries (staff sees only their own)
router.get('/mine', protect, staffOnly, getMyEnquiries);

// Get follow-ups due today
router.get('/follow-ups/today', protect, staffOnly, getFollowUpsToday);

// ─── Manager+ ────────────────────────────────────────────────────────────────
// Get ALL enquiries with search/filter support
router.get('/', protect, managerOnly, getAllEnquiries);

// CRM pipeline stats / funnel metrics
router.get('/stats', protect, managerOnly, getEnquiryStats);

// Export to CSV
router.get('/export', protect, managerOnly, exportEnquiries);

// Bulk actions (reassign / close / mark follow-up)
router.post('/bulk', protect, managerOnly, bulkUpdateEnquiries);

// ─── Staff+ by ID ─────────────────────────────────────────────────────────────
// Get single enquiry detail (staff can only access their own)
router.get('/:id', protect, staffOnly, getEnquiryById);

// Update enquiry (status, notes, follow-up date, tags, etc.)
router.put('/:id', protect, staffOnly, updateEnquiry);

// Log a call attempt (DNP / answered / WhatsApp sent / etc.)
router.post('/:id/call', protect, staffOnly, logCall);

// Send booking link email to customer
router.post('/:id/send-booking-link', protect, staffOnly, sendBookingLinkHandler);

// Delete enquiry (manager/admin only)
router.delete('/:id', protect, managerOnly, deleteEnquiry);

export default router;
