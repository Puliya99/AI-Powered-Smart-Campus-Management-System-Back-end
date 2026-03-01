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
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, curl, etc.)
      if (!origin) return callback(null, true);

      const allowedOrigins = env.CORS_ORIGIN.split(',').map(o => o.trim());
      const isAllowed = allowedOrigins.some(allowed => {
        if (allowed === '*') return true;
        if (allowed === origin) return true;
        // Support wildcard subdomains, e.g. https://*.vercel.app
        if (allowed.includes('*')) {
          const regex = new RegExp('^' + allowed.replace(/\*/g, '.*') + '$');
          return regex.test(origin);
        }
        return false;
      });

      if (isAllowed) {
        callback(null, true);
      } else {
        callback(new Error(`Origin ${origin} not allowed by CORS`));
      }
    },
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
  skip: (req) => {
    // Skip rate limiting for static files if they are served through this middleware
    return req.path.startsWith('/uploads');
  },
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // Limit each IP to 20 login/register requests per windowMs
  message: 'Too many authentication attempts, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api/v1/auth/login', authLimiter);
app.use('/api/v1/auth/register', authLimiter);
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

// Serve Static Files
app.use('/uploads', express.static(env.UPLOAD_PATH));

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
