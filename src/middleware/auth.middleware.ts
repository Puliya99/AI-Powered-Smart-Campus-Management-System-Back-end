import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { AppDataSource } from '../config/database';
import { User } from '../entities/User.entity';
import { Role } from '../enums/Role.enum';

interface JwtPayload {
  userId: string;
  role: string;
}

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      user?: {
        userId: string;
        role: Role;
        email: string;
      };
    }
  }
}

export class AuthMiddleware {
  // Verify JWT token
  async authenticate(req: Request, res: Response, next: NextFunction) {
    try {
      // Get token from header
      const authHeader = req.headers.authorization;

      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({
          status: 'error',
          message: 'No token provided',
        });
      }

      const token = authHeader.substring(7);

      // Verify token
      const decoded = jwt.verify(token, env.JWT_SECRET) as JwtPayload;

      // Get user from database
      const userRepository = AppDataSource.getRepository(User);
      const user = await userRepository.findOne({
        where: { id: decoded.userId },
      });

      if (!user) {
        return res.status(401).json({
          status: 'error',
          message: 'User not found',
        });
      }

      if (!user.isActive) {
        return res.status(401).json({
          status: 'error',
          message: 'Account is inactive',
        });
      }

      // Attach user to request
      req.user = {
        userId: user.id,
        role: user.role,
        email: user.email,
      };

      next();
    } catch (error: any) {
      if (error.name === 'TokenExpiredError') {
        return res.status(401).json({
          status: 'error',
          message: 'Token has expired',
        });
      }

      if (error.name === 'JsonWebTokenError') {
        return res.status(401).json({
          status: 'error',
          message: 'Invalid token',
        });
      }

      return res.status(500).json({
        status: 'error',
        message: 'Authentication error',
      });
    }
  }

  // Check specific roles
  authorize(...roles: Role[]) {
    return (req: Request, res: Response, next: NextFunction) => {
      if (!req.user) {
        return res.status(401).json({
          status: 'error',
          message: 'Not authenticated',
        });
      }

      if (!roles.includes(req.user.role)) {
        return res.status(403).json({
          status: 'error',
          message: 'Access denied. Insufficient permissions.',
        });
      }

      next();
    };
  }

  // Admin only
  isAdmin(req: Request, res: Response, next: NextFunction) {
    if (!req.user) {
      return res.status(401).json({
        status: 'error',
        message: 'Not authenticated',
      });
    }

    if (req.user.role !== Role.ADMIN) {
      return res.status(403).json({
        status: 'error',
        message: 'Admin access required',
      });
    }

    next();
  }

  // Lecturer or Admin
  isLecturerOrAdmin(req: Request, res: Response, next: NextFunction) {
    if (!req.user) {
      return res.status(401).json({
        status: 'error',
        message: 'Not authenticated',
      });
    }

    if (req.user.role !== Role.LECTURER && req.user.role !== Role.ADMIN) {
      return res.status(403).json({
        status: 'error',
        message: 'Lecturer or Admin access required',
      });
    }

    next();
  }

  // Student only
  isStudent(req: Request, res: Response, next: NextFunction) {
    if (!req.user) {
      return res.status(401).json({
        status: 'error',
        message: 'Not authenticated',
      });
    }

    if (req.user.role !== Role.STUDENT) {
      return res.status(403).json({
        status: 'error',
        message: 'Student access required',
      });
    }

    next();
  }
}

export default new AuthMiddleware();
