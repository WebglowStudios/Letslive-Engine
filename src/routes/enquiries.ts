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
  getCustomerEnquiries,
  getCustomerEnquiryById,
  submitEnquiryFeedback,
} from '../controllers/enquiryController.js';

import { protect, optionalProtect, requirePermission } from '../middleware/auth.js';
import { enquiryLimiter } from '../middleware/rateLimiter.js';

const router = Router();

// ─── Public ──────────────────────────────────────────────────────────────────
// Public: create enquiry from website (rate-limited)
// optionalProtect silently reads the logged-in user's ID from their cookie (if any)
// so the enquiry gets linked to the user account and appears in their dashboard.
router.post('/', enquiryLimiter, optionalProtect, createEnquiry);

// ─── Customer Authenticated ──────────────────────────────────────────────────
// Get enquiries for the currently logged in customer
router.get('/customer/me', protect, getCustomerEnquiries);
// Get specific enquiry details for the currently logged in customer
router.get('/customer/me/:id', protect, getCustomerEnquiryById);
// Submit feedback for the assigned employee
router.post('/customer/me/:id/feedback', protect, submitEnquiryFeedback);

// ─── Staff+ (auth required) ───────────────────────────────────────────────────
// Manually create a walk-in / phone / WhatsApp lead
router.post('/manual', protect, requirePermission('enquiries.respond'), manualCreateEnquiry);

// Get my assigned enquiries (staff sees only their own)
router.get('/mine', protect, requirePermission('enquiries.view'), getMyEnquiries);

// Get follow-ups due today
router.get('/follow-ups/today', protect, requirePermission('enquiries.view'), getFollowUpsToday);

// ─── Manager+ ────────────────────────────────────────────────────────────────
// Get ALL enquiries with search/filter support
router.get('/', protect, requirePermission('enquiries.view'), getAllEnquiries);

// CRM pipeline stats / funnel metrics
router.get('/stats', protect, requirePermission('enquiries.view'), getEnquiryStats);

// Export to CSV
router.get('/export', protect, requirePermission('enquiries.view'), exportEnquiries);

// Bulk actions (reassign / close / mark follow-up)
router.post('/bulk', protect, requirePermission('enquiries.respond'), bulkUpdateEnquiries);

// ─── Staff+ by ID ─────────────────────────────────────────────────────────────
// Get single enquiry detail (staff can only access their own)
router.get('/:id', protect, requirePermission('enquiries.view'), getEnquiryById);

// Update enquiry (status, notes, follow-up date, tags, etc.)
router.put('/:id', protect, requirePermission('enquiries.respond'), updateEnquiry);

// Log a call attempt (DNP / answered / WhatsApp sent / etc.)
router.post('/:id/call', protect, requirePermission('enquiries.respond'), logCall);

// Send booking link email to customer
router.post('/:id/send-booking-link', protect, requirePermission('enquiries.respond'), sendBookingLinkHandler);

// Delete enquiry (manager/admin only)
router.delete('/:id', protect, requirePermission('enquiries.delete'), deleteEnquiry);

export default router;
