import { Router } from 'express';
import express from 'express';
import { razorpayWebhook } from '../controllers/webhookController.js';

const router = Router();

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/webhooks/razorpay
//
// Uses express.raw() — NOT express.json() — so the body arrives as a raw
// Buffer. This is required for HMAC-SHA256 signature verification.
// Razorpay computes the signature over the raw request body; if express.json()
// parsed it first, the re-serialised string would produce a different hash
// and verification would always fail.
// ─────────────────────────────────────────────────────────────────────────────
router.post(
  '/razorpay',
  express.raw({ type: 'application/json' }),
  razorpayWebhook
);

export default router;
