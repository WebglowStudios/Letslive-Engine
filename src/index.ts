import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import mongoSanitize from 'express-mongo-sanitize';
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

const app = express();

// Connect to MongoDB
await connectDB();

// 1. Security HTTP headers
app.use(helmet());

// 2. CORS
app.use(
  cors({
    origin: env.FRONTEND_URL,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  })
);

// 3. Rate limiters on specific paths
app.use('/api', apiLimiter);
app.use('/api/auth', authLimiter);
app.use('/api/enquiries', enquiryLimiter);

// 4. Body parser
app.use(express.json({ limit: '10kb' }));

// 5. URL encoded parser
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// 6. Cookie parser
app.use(cookieParser());

// 7. Data sanitization against NoSQL injection
app.use(mongoSanitize());

// 8. Prevent HTTP parameter pollution
app.use(hpp());

// 9. Compression
app.use(compression());

// 10. Logging in development
if (env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

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
app.all('*', (req, _res, next) => {
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
