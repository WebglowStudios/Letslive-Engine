import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import hpp from 'hpp';
import compression from 'compression';
import morgan from 'morgan';
import cron from 'node-cron';

import { env } from './config/env.js';
import { connectDB } from './config/db.js';
import { globalErrorHandler, AppError } from './middleware/errorHandler.js';
import { apiLimiter, authLimiter, enquiryLimiter } from './middleware/rateLimiter.js';
import authRoutes from './routes/auth.js';
import destinationRoutes from './routes/destinations.js';
import packageRoutes from './routes/packages.js';
import reviewRoutes from './routes/reviews.js';
import bookingRoutes from './routes/bookings.js';
import enquiryRoutes from './routes/enquiries.js';
import newsletterRoutes from './routes/newsletter.js';
import careerRoutes from './routes/careers.js';
import userRoutes from './routes/users.js';
import adminRoutes from './routes/admin.js';
import articleRoutes from './routes/articles.js';
import operationRoutes from './routes/operations.js';
import vendorRoutes from './routes/vendors.js';
import uploadRoutes from './routes/upload.js';
import packageTemplateRoutes from './routes/packageTemplates.js';
import paymentRoutes from './routes/payments.js';
import webhookRoutes from './routes/webhooks.js';
import couponRoutes from './routes/coupons.js';
import financeRoutes from './routes/finance.js';
import aboutRoutes from './routes/about.js';
import galleryRoutes from './routes/gallery.js';

const app = express();

// Trust first proxy (Nginx) so rate-limiter and req.ip work correctly
app.set('trust proxy', 1);

// Connect to MongoDB
await connectDB();

// 1. Security HTTP headers
app.use(helmet());

// 2. CORS
const allowedOrigins = [
  env.FRONTEND_URL,
  process.env.ADMIN_URL || 'http://localhost:3001',
  'http://localhost:3000',
  'http://localhost:3001',
  'https://letslivetours.com',
  'https://www.letslivetours.com',
  'https://admin.letslivetours.com',
];
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, curl, etc.)
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else if (env.NODE_ENV !== 'production') {
        callback(null, true); // Allow all in dev only
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  })
);

// 3. Rate limiters on specific paths (skip upload routes — they're auth-protected and need more headroom)
app.use('/api', (req, res, next) => {
  if (req.path.startsWith('/upload')) return next();
  return apiLimiter(req, res, next);
});

// 4a. Webhook routes — must be mounted BEFORE express.json() so the body
//     arrives as a raw Buffer for HMAC-SHA256 signature verification.
//     express.raw() is applied per-route inside routes/webhooks.ts.
app.use('/api/webhooks', webhookRoutes);

// 4b. Body parser (all other routes)
app.use(express.json({ limit: '5mb' }));

// 5. URL encoded parser
app.use(express.urlencoded({ extended: true, limit: '5mb' }));

// 6. Cookie parser
app.use(cookieParser());

// 7. Data sanitization against NoSQL injection (custom, Express 5 compatible)
app.use((req, _res, next) => {
  const sanitize = (obj: Record<string, unknown>): void => {
    for (const key in obj) {
      if (key.startsWith('$') || key.includes('.')) {
        delete obj[key];
      } else if (typeof obj[key] === 'object' && obj[key] !== null) {
        sanitize(obj[key] as Record<string, unknown>);
      }
    }
  };
  if (req.body && typeof req.body === 'object') sanitize(req.body);
  next();
});

// 8. Prevent HTTP parameter pollution
app.use(hpp());

// 9. Compression
app.use(compression());

// 10. Logging in development
if (env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// Root route
app.get('/', (_req, res) => {
  res.status(200).json({
    message: '🚀 LetsLive Engine is running',
    version: '1.0.0',
    endpoints: '/api/health for full status',
  });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/destinations', destinationRoutes);
app.use('/api/packages', packageRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/enquiries', enquiryRoutes);
app.use('/api/newsletter', newsletterRoutes);
app.use('/api/careers', careerRoutes);
app.use('/api/users', userRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/articles', articleRoutes);
app.use('/api/operations', operationRoutes);
app.use('/api/vendors', vendorRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/package-templates', packageTemplateRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/coupons', couponRoutes);
app.use('/api/finance', financeRoutes);
app.use('/api/about', aboutRoutes);
app.use('/api/gallery', galleryRoutes);
// Note: /api/webhooks is mounted earlier (before express.json) — see above

// Health check endpoint
app.get('/api/health', (_req, res) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: env.NODE_ENV,
  });
});

// 404 handler for unmatched routes
app.use((req, _res, next) => {
  next(new AppError(`Cannot find ${req.originalUrl} on this server`, 404));
});

// Global error handler (must be last)
app.use(globalErrorHandler);

// Start server
const PORT = env.PORT;
app.listen(PORT, () => {
  console.log(`[🚀 LetsLive Engine v1.1.0] Server running on port ${PORT} in ${env.NODE_ENV} mode`);
});

import { sendFollowUpReminder } from './services/emailService.js';
import Enquiry from './models/Enquiry.js';

// ─── Daily Follow-Up Reminder Cron ───────────────────────────────────────────
// Runs every day at 9:00 AM IST (03:30 UTC)
cron.schedule('30 3 * * *', async () => {
  console.log('[CRON] Running daily follow-up reminder...');
  try {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    const enquiries = await Enquiry.find({
      followUpDate: { $gte: startOfDay, $lte: endOfDay },
      status: { $nin: ['converted', 'closed', 'resolved'] },
      assignedTo: { $exists: true },
    }).populate('assignedTo', 'firstName lastName email');

    if (enquiries.length === 0) {
      console.log('[CRON] No follow-ups due today.');
      return;
    }

    // Group by staff member
    const byStaff = new Map<string, { email: string; name: string; items: { customerName: string; phone: string; notes?: string }[] }>();

    for (const enq of enquiries) {
      const staff = enq.assignedTo as unknown as { _id: string; firstName: string; lastName?: string; email: string } | null;
      if (!staff?.email) continue;
      const key = staff.email;
      if (!byStaff.has(key)) {
        byStaff.set(key, { email: staff.email, name: `${staff.firstName} ${staff.lastName || ''}`.trim(), items: [] });
      }
      byStaff.get(key)!.items.push({
        customerName: `${enq.firstName} ${enq.lastName || ''}`.trim(),
        phone: enq.phone,
        notes: enq.followUpNotes,
      });
    }

    // Send batched email to each staff member
    for (const { email, name, items } of byStaff.values()) {
      await sendFollowUpReminder(email, name, items).catch(console.error);
    }

    console.log(`[CRON] Follow-up reminders sent to ${byStaff.size} staff member(s) for ${enquiries.length} enquiry(ies).`);
  } catch (err) {
    console.error('[CRON] Follow-up reminder failed:', err);
  }
});

export default app;
