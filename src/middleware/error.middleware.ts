import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

export class ApiError extends Error {
  statusCode: number;
  isOperational: boolean;

  constructor(statusCode: number, message: string, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    Error.captureStackTrace(this, this.constructor);
  }
}

export const errorMiddleware = (err: any, req: Request, res: Response, next: NextFunction) => {
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Internal Server Error';

  // Log error
  logger.error({
    statusCode,
    message,
    stack: err.stack,
    url: req.originalUrl,
    method: req.method,
  });

  // TypeORM errors
  if (err.name === 'QueryFailedError') {
    statusCode = 400;
    message = 'Database query failed';
  }

  // Validation errors
  if (err.name === 'ValidationError') {
    statusCode = 400;
    message = err.message;
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Invalid token';
  }

  if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Token expired';
  }

  // Duplicate key error
  if (err.code === '23505') {
    statusCode = 409;
    message = 'Resource already exists';
  }

  // Always include stack trace in response
  res.status(statusCode).json({
    status: 'error',
    statusCode,
    message,
    stack: err.stack,
  });
};
