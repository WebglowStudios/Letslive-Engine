import { Request, Response, NextFunction } from 'express';
import { env } from '../config/env.js';

export class AppError extends Error {
  statusCode: number;
  status: string;
  isOperational: boolean;

  constructor(message: string, statusCode: number) {
    super(message);
    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

interface MongooseValidationError {
  errors: Record<string, { message: string }>;
}

interface MongooseCastError {
  path: string;
  value: unknown;
}

interface MongoDuplicateKeyError {
  keyValue: Record<string, unknown>;
}

const handleCastError = (err: MongooseCastError): AppError => {
  const message = `Invalid ${err.path}: ${err.value}`;
  return new AppError(message, 400);
};

const handleDuplicateKeyError = (err: MongoDuplicateKeyError): AppError => {
  const field = Object.keys(err.keyValue)[0];
  const message = `Duplicate value for field "${field}". Please use another value.`;
  return new AppError(message, 400);
};

const handleValidationError = (err: MongooseValidationError): AppError => {
  const errors = Object.values(err.errors).map((el) => el.message);
  const message = `Invalid input data: ${errors.join('. ')}`;
  return new AppError(message, 400);
};

const handleJWTError = (): AppError =>
  new AppError('Invalid token. Please log in again.', 401);

const handleJWTExpiredError = (): AppError =>
  new AppError('Your token has expired. Please log in again.', 401);

export const globalErrorHandler = (
  err: AppError & { code?: number; errors?: Record<string, { message: string }>; path?: string; value?: unknown; keyValue?: Record<string, unknown> },
  _req: Request,
  res: Response,
  _next: NextFunction
): void => {
  err.statusCode = err.statusCode || 500;
  err.status = err.status || 'error';

  if (env.NODE_ENV === 'development') {
    res.status(err.statusCode).json({
      status: err.status,
      error: err,
      message: err.message,
      stack: err.stack,
    });
    return;
  }

  // Production: create a copy to avoid mutating the original
  let error = { ...err, message: err.message };

  if (err.name === 'CastError') {
    error = handleCastError(err as unknown as MongooseCastError) as typeof err;
  }
  if (err.code === 11000) {
    error = handleDuplicateKeyError(err as unknown as MongoDuplicateKeyError) as typeof err;
  }
  if (err.name === 'ValidationError') {
    error = handleValidationError(err as unknown as MongooseValidationError) as typeof err;
  }
  if (err.name === 'JsonWebTokenError') {
    error = handleJWTError() as typeof err;
  }
  if (err.name === 'TokenExpiredError') {
    error = handleJWTExpiredError() as typeof err;
  }

  if (error.isOperational) {
    res.status(error.statusCode).json({
      status: error.status,
      message: error.message,
    });
  } else {
    console.error('ERROR:', err);
    res.status(500).json({
      status: 'error',
      message: 'Something went wrong',
    });
  }
};

export default globalErrorHandler;
