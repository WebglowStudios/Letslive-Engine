import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import hpp from 'hpp';
import compression from 'compression';
import morgan from 'morgan';

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

const app = express();

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

// 3. Rate limiters on specific paths
app.use('/api', apiLimiter);
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);
app.use('/api/enquiries', enquiryLimiter);

// 4. Body parser
app.use(express.json({ limit: '10kb' }));

// 5. URL encoded parser
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

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
  console.log(`Server running on port ${PORT} in ${env.NODE_ENV} mode`);
});

export default app;
