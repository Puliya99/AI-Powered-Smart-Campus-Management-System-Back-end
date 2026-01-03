import 'reflect-metadata';
import 'express-async-errors';
import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import { env } from './config/env';
import routes from './routes';
import { errorMiddleware } from './middleware/error.middleware';
import { logger } from './utils/logger';

const app: Application = express();

// Security Middleware
app.use(helmet());
app.use(
  cors({
    origin: env.CORS_ORIGIN,
    credentials: true,
  })
);

// Rate Limiting
const limiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.RATE_LIMIT_MAX_REQUESTS,
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api', limiter);

// Body Parser Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Compression
app.use(compression());

// Logging Middleware
app.use(morgan('dev'));

// Root Route
app.get('/', (req: Request, res: Response) => {
  res.json({
    status: 'success',
    message: 'Smart Campus Backend (TypeScript) running...',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  });
});

// Health Check Endpoint
app.get('/health', (req: Request, res: Response) => {
  res.status(200).json({
    status: 'success',
    message: 'Smart Campus API is running',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// API Routes
app.use(env.API_PREFIX, routes);

// 404 Handler
app.use((req: Request, res: Response) => {
  res.status(404).json({
    status: 'error',
    message: `Route ${req.originalUrl} not found`,
    timestamp: new Date().toISOString(),
  });
});

// Global Error Handler
app.use(errorMiddleware);

export default app;
