import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import User from '../models/User.js';
import { AppError } from './errorHandler.js';
import { asyncHandler } from './asyncHandler.js';

interface JwtPayload {
  id: string;
  iat: number;
  exp: number;
}

export const protect = asyncHandler(
  async (req: Request, _res: Response, next: NextFunction) => {
    const token = req.cookies?.accessToken;

    if (!token) {
      throw new AppError('Not authorized. Please log in.', 401);
    }

    const decoded = jwt.verify(token, env.JWT_SECRET) as JwtPayload;

    const user = await User.findById(decoded.id);
    if (!user) {
      throw new AppError('User belonging to this token no longer exists.', 401);
    }

    req.user = user;
    next();
  }
);

export const adminOnly = (req: Request, _res: Response, next: NextFunction): void => {
  if (!req.user || req.user.role !== 'admin') {
    next(new AppError('Access denied. Admin only.', 403));
    return;
  }
  next();
};

// Flexible role-based access control
export const roleCheck = (...allowedRoles: string[]) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      next(new AppError(`Access denied. Required role: ${allowedRoles.join(' or ')}.`, 403));
      return;
    }
    next();
  };
};

// Staff+ access (admin, manager, staff)
export const staffOnly = roleCheck('admin', 'manager', 'staff');

// Manager+ access (admin, manager)
export const managerOnly = roleCheck('admin', 'manager');
