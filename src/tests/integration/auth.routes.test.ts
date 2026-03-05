/**
 * Integration tests for /api/v1/auth routes.
 *
 * Strategy:
 *  - A minimal Express app is assembled with only the auth router.
 *  - The database, env, and auth/email services are fully mocked so no
 *    real PostgreSQL connection is required.
 *  - Protected routes are exercised by supplying a signed JWT and
 *    configuring the mock repository to return a matching user.
 */

import 'reflect-metadata';
import express, { Application } from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';

// ── Mocks (hoisted before all imports) ────────────────────────────────────────
jest.mock('../../config/database', () => ({
  AppDataSource: {
    getRepository: jest.fn().mockReturnValue({ findOne: jest.fn() }),
  },
}));

jest.mock('../../config/env', () => ({
  env: {
    PORT: 5000,
    API_PREFIX: '/api/v1',
    JWT_SECRET: 'integration-test-secret-must-be-long-enough!!',
    JWT_EXPIRE: '1h',
    CORS_ORIGIN: 'http://localhost:3000',
    RATE_LIMIT_WINDOW_MS: 900000,
    RATE_LIMIT_MAX_REQUESTS: 1000,
    LOG_LEVEL: 'silent',
  },
}));

jest.mock('../../services/auth.service', () => ({
  __esModule: true,
  default: {
    register: jest.fn(),
    login: jest.fn(),
    getCurrentUser: jest.fn(),
    changePassword: jest.fn(),
    updateProfile: jest.fn(),
    logout: jest.fn(),
  },
}));

jest.mock('../../services/email.service', () => ({
  default: {
    sendAccountCreationEmail: jest.fn(),
    sendPasswordChangedEmail: jest.fn(),
  },
}));

// ── Imports ───────────────────────────────────────────────────────────────────
import authRoutes from '../../routes/auth.routes';
import authService from '../../services/auth.service';
import { AppDataSource } from '../../config/database';
import { Role } from '../../enums/Role.enum';

// ── App setup ─────────────────────────────────────────────────────────────────
const app: Application = express();
app.use(express.json());
app.use('/auth', authRoutes);
// Minimal error handler so unhandled throws return JSON
app.use((err: any, _req: any, res: any, _next: any) => {
  res.status(err.status || 500).json({ status: 'error', message: err.message });
});

const mockAuth = authService as jest.Mocked<typeof authService>;

// JWT secret must match the mocked env
const TEST_SECRET = 'integration-test-secret-must-be-long-enough!!';

function signToken(payload: object) {
  return jwt.sign(payload, TEST_SECRET, { expiresIn: '1h' });
}

// ── POST /auth/register ───────────────────────────────────────────────────────
describe('POST /auth/register', () => {
  const validBody = {
    username: 'johndoe',
    email: 'john@example.com',
    password: 'Password1',
    firstName: 'John',
    lastName: 'Doe',
  };

  it('201 — returns user and token on successful registration', async () => {
    mockAuth.register.mockResolvedValue({
      user: {
        id: 'u1',
        username: 'johndoe',
        email: 'john@example.com',
        firstName: 'John',
        lastName: 'Doe',
        role: Role.STUDENT,
        registrationNumber: 'REG20260001',
        isActive: true,
      } as any,
      token: 'mock.jwt.token',
    });

    const res = await request(app).post('/auth/register').send(validBody);

    expect(res.status).toBe(201);
    expect(res.body.status).toBe('success');
    expect(res.body.data.token).toBe('mock.jwt.token');
    expect(res.body.data.user.email).toBe('john@example.com');
  });

  it('400 — returns validation errors when required fields are missing', async () => {
    const res = await request(app).post('/auth/register').send({});

    expect(res.status).toBe(400);
    expect(res.body.status).toBe('error');
    expect(Array.isArray(res.body.errors)).toBe(true);
    expect(res.body.errors.length).toBeGreaterThan(0);
  });

  it('400 — returns validation error for invalid email format', async () => {
    const res = await request(app)
      .post('/auth/register')
      .send({ ...validBody, email: 'not-an-email' });

    expect(res.status).toBe(400);
    expect(res.body.errors.some((e: any) => e.field === 'email')).toBe(true);
  });

  it('400 — returns validation error for weak password', async () => {
    const res = await request(app)
      .post('/auth/register')
      .send({ ...validBody, password: 'weakpass' });

    expect(res.status).toBe(400);
    expect(res.body.errors.some((e: any) => e.field === 'password')).toBe(true);
  });

  it('400 — returns service error when email is already registered', async () => {
    mockAuth.register.mockRejectedValue(new Error('Email already registered'));

    const res = await request(app).post('/auth/register').send(validBody);

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Email already registered');
  });

  it('400 — returns service error when username is already taken', async () => {
    mockAuth.register.mockRejectedValue(new Error('Username already taken'));

    const res = await request(app).post('/auth/register').send(validBody);

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Username already taken');
  });
});

// ── POST /auth/login ──────────────────────────────────────────────────────────
describe('POST /auth/login', () => {
  const validCreds = { email: 'john@example.com', password: 'Password1' };

  it('200 — returns token on valid credentials', async () => {
    mockAuth.login.mockResolvedValue({
      user: { id: 'u1', email: 'john@example.com', role: Role.STUDENT } as any,
      token: 'mock.login.token',
    });

    const res = await request(app).post('/auth/login').send(validCreds);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
    expect(res.body.data.token).toBe('mock.login.token');
  });

  it('400 — validation error for missing email', async () => {
    const res = await request(app).post('/auth/login').send({ password: 'Password1' });

    expect(res.status).toBe(400);
    expect(res.body.errors.some((e: any) => e.field === 'email')).toBe(true);
  });

  it('400 — validation error for invalid email format', async () => {
    const res = await request(app)
      .post('/auth/login')
      .send({ email: 'not-email', password: 'Password1' });

    expect(res.status).toBe(400);
  });

  it('401 — returns error on wrong credentials', async () => {
    mockAuth.login.mockRejectedValue(new Error('Invalid email or password'));

    const res = await request(app).post('/auth/login').send(validCreds);

    expect(res.status).toBe(401);
    expect(res.body.message).toBe('Invalid email or password');
  });
});

// ── POST /auth/logout ─────────────────────────────────────────────────────────
describe('POST /auth/logout', () => {
  it('200 — succeeds for an authenticated user', async () => {
    // Set up the mock DB so the authenticate middleware finds the user
    const mockRepo = { findOne: jest.fn() };
    (AppDataSource.getRepository as jest.Mock).mockReturnValue(mockRepo);
    mockRepo.findOne.mockResolvedValue({
      id: 'u1',
      role: Role.STUDENT,
      email: 'j@test.com',
      isActive: true,
      center: null,
    });

    mockAuth.logout.mockResolvedValue({ message: 'Logged out successfully' });

    const token = signToken({ userId: 'u1', role: Role.STUDENT });

    const res = await request(app)
      .post('/auth/logout')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
  });

  it('401 — rejects unauthenticated request', async () => {
    const res = await request(app).post('/auth/logout');
    expect(res.status).toBe(401);
  });
});

// ── GET /auth/me ──────────────────────────────────────────────────────────────
describe('GET /auth/me', () => {
  it('200 — returns user data for an authenticated request', async () => {
    const mockRepo = { findOne: jest.fn() };
    (AppDataSource.getRepository as jest.Mock).mockReturnValue(mockRepo);
    mockRepo.findOne.mockResolvedValue({
      id: 'u1',
      role: Role.STUDENT,
      email: 'j@test.com',
      isActive: true,
      center: null,
    });

    mockAuth.getCurrentUser.mockResolvedValue({
      id: 'u1',
      email: 'j@test.com',
      username: 'johndoe',
      role: Role.STUDENT,
    } as any);

    const token = signToken({ userId: 'u1', role: Role.STUDENT });

    const res = await request(app)
      .get('/auth/me')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.user.email).toBe('j@test.com');
  });

  it('401 — rejects request without Authorization header', async () => {
    const res = await request(app).get('/auth/me');
    expect(res.status).toBe(401);
  });

  it('401 — rejects an expired JWT', async () => {
    const expired = jwt.sign({ userId: 'u1', role: Role.STUDENT }, TEST_SECRET, {
      expiresIn: -1,
    });

    const res = await request(app)
      .get('/auth/me')
      .set('Authorization', `Bearer ${expired}`);

    expect(res.status).toBe(401);
    expect(res.body.message).toMatch(/expired/i);
  });
});
