import { Request, Response, NextFunction } from 'express';
import { Role } from '../enums/Role.enum';

/**
 * Middleware that auto-injects centerId into req.query for non-ADMIN users.
 * This ensures non-ADMIN users can only access data from their assigned center.
 * Must be placed after authenticate middleware.
 */
export function applyCenterFilter(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    return next();
  }

  // ADMIN sees everything — no filter applied
  if (req.user.role === Role.ADMIN) {
    return next();
  }

  // Non-ADMIN with an assigned center — force the filter
  if (req.user.centerId) {
    req.query.centerId = req.user.centerId;
  }

  next();
}
