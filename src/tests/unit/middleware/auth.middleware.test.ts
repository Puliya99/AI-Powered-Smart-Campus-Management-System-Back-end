import 'reflect-metadata';
import { Request, Response, NextFunction } from 'express';

// ── Mocks (hoisted before imports) ──────────────────────────────────────────
jest.mock('jsonwebtoken');

jest.mock('../../../config/database', () => ({
  AppDataSource: { getRepository: jest.fn() },
}));

jest.mock('../../../config/env', () => ({
  env: { JWT_SECRET: 'test-secret', JWT_EXPIRE: '7d' },
}));

// ── Imports ──────────────────────────────────────────────────────────────────
import jwt from 'jsonwebtoken';
import { AuthMiddleware } from '../../../middleware/auth.middleware';
import { AppDataSource } from '../../../config/database';
import { Role } from '../../../enums/Role.enum';

// ── Helpers ──────────────────────────────────────────────────────────────────
const mockRepo = { findOne: jest.fn() };

function buildRes(): Response {
  const res: Partial<Response> = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res as Response;
}

function buildReq(overrides: Partial<Request> = {}): Request {
  return { headers: {}, ...overrides } as unknown as Request;
}

// Create a fresh instance (not the module-level singleton)
// so tests don't bleed state into each other.
let middleware: AuthMiddleware;

beforeEach(() => {
  jest.clearAllMocks();
  (AppDataSource.getRepository as jest.Mock).mockReturnValue(mockRepo);
  middleware = new AuthMiddleware();
});

// ── authenticate ─────────────────────────────────────────────────────────────
describe('AuthMiddleware.authenticate', () => {
  let next: NextFunction;

  beforeEach(() => {
    next = jest.fn();
  });

  it('responds 401 when Authorization header is missing', async () => {
    const res = buildRes();
    await middleware.authenticate(buildReq(), res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'No token provided' }),
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('responds 401 when header does not start with "Bearer "', async () => {
    const res = buildRes();
    await middleware.authenticate(
      buildReq({ headers: { authorization: 'Basic abc123' } }),
      res,
      next,
    );

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('responds 401 with "Token has expired" for a TokenExpiredError', async () => {
    const expiredErr = Object.assign(new Error('jwt expired'), { name: 'TokenExpiredError' });
    (jwt.verify as jest.Mock).mockImplementation(() => { throw expiredErr; });

    const res = buildRes();
    await middleware.authenticate(
      buildReq({ headers: { authorization: 'Bearer expiredtoken' } }),
      res,
      next,
    );

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Token has expired' }),
    );
  });

  it('responds 401 with "Invalid token" for a JsonWebTokenError', async () => {
    const badErr = Object.assign(new Error('jwt malformed'), { name: 'JsonWebTokenError' });
    (jwt.verify as jest.Mock).mockImplementation(() => { throw badErr; });

    const res = buildRes();
    await middleware.authenticate(
      buildReq({ headers: { authorization: 'Bearer badtoken' } }),
      res,
      next,
    );

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Invalid token' }),
    );
  });

  it('responds 401 when user is not found in the database', async () => {
    (jwt.verify as jest.Mock).mockReturnValue({ userId: 'u1', role: Role.STUDENT });
    mockRepo.findOne.mockResolvedValue(null);

    const res = buildRes();
    await middleware.authenticate(
      buildReq({ headers: { authorization: 'Bearer validtoken' } }),
      res,
      next,
    );

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'User not found' }),
    );
  });

  it('responds 401 when the user account is inactive', async () => {
    (jwt.verify as jest.Mock).mockReturnValue({ userId: 'u1', role: Role.STUDENT });
    mockRepo.findOne.mockResolvedValue({
      id: 'u1',
      role: Role.STUDENT,
      email: 'test@test.com',
      isActive: false,
    });

    const res = buildRes();
    await middleware.authenticate(
      buildReq({ headers: { authorization: 'Bearer validtoken' } }),
      res,
      next,
    );

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Account is inactive' }),
    );
  });

  it('calls next() and attaches user to req for a valid token', async () => {
    (jwt.verify as jest.Mock).mockReturnValue({ userId: 'u1', role: Role.STUDENT });
    mockRepo.findOne.mockResolvedValue({
      id: 'u1',
      role: Role.STUDENT,
      email: 'student@test.com',
      isActive: true,
      center: { id: 'center-1' },
    });

    const req = buildReq({ headers: { authorization: 'Bearer validtoken' } });
    const res = buildRes();
    await middleware.authenticate(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect((req as any).user).toEqual({
      userId: 'u1',
      role: Role.STUDENT,
      email: 'student@test.com',
      centerId: 'center-1',
    });
  });

  it('sets centerId to undefined when user has no center', async () => {
    (jwt.verify as jest.Mock).mockReturnValue({ userId: 'u2', role: Role.ADMIN });
    mockRepo.findOne.mockResolvedValue({
      id: 'u2',
      role: Role.ADMIN,
      email: 'admin@test.com',
      isActive: true,
      center: null,
    });

    const req = buildReq({ headers: { authorization: 'Bearer admintoken' } });
    const res = buildRes();
    await middleware.authenticate(req, res, next);

    expect(next).toHaveBeenCalled();
    expect((req as any).user.centerId).toBeUndefined();
  });

  it('responds 503 on unexpected database error', async () => {
    (jwt.verify as jest.Mock).mockReturnValue({ userId: 'u1', role: Role.STUDENT });
    mockRepo.findOne.mockRejectedValue(new Error('DB connection lost'));

    const res = buildRes();
    await middleware.authenticate(
      buildReq({ headers: { authorization: 'Bearer validtoken' } }),
      res,
      next,
    );

    expect(res.status).toHaveBeenCalledWith(503);
  });
});

// ── authorize ────────────────────────────────────────────────────────────────
describe('AuthMiddleware.authorize', () => {
  let next: NextFunction;

  beforeEach(() => {
    next = jest.fn();
  });

  it('responds 401 when req.user is not attached', () => {
    const res = buildRes();
    middleware.authorize(Role.ADMIN)(buildReq(), res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('responds 403 when user role is not in the allowed list', () => {
    const req = { ...buildReq(), user: { userId: '1', role: Role.STUDENT, email: 'a@b.com' } } as any;
    const res = buildRes();
    middleware.authorize(Role.ADMIN)(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('calls next() when user role matches a single allowed role', () => {
    const req = { ...buildReq(), user: { userId: '1', role: Role.ADMIN, email: 'a@b.com' } } as any;
    middleware.authorize(Role.ADMIN)(req, buildRes(), next);

    expect(next).toHaveBeenCalledTimes(1);
  });

  it('calls next() when user role is one of multiple allowed roles', () => {
    const req = { ...buildReq(), user: { userId: '1', role: Role.LECTURER, email: 'l@b.com' } } as any;
    middleware.authorize(Role.ADMIN, Role.LECTURER)(req, buildRes(), next);

    expect(next).toHaveBeenCalledTimes(1);
  });
});

// ── isAdmin ───────────────────────────────────────────────────────────────────
describe('AuthMiddleware.isAdmin', () => {
  let next: NextFunction;

  beforeEach(() => {
    next = jest.fn();
  });

  it('responds 401 when req.user is not attached', () => {
    const res = buildRes();
    middleware.isAdmin(buildReq(), res, next);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('responds 403 for a non-admin user', () => {
    const req = { ...buildReq(), user: { userId: '1', role: Role.STUDENT, email: 'a@b.com' } } as any;
    const res = buildRes();
    middleware.isAdmin(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('calls next() for an admin user', () => {
    const req = { ...buildReq(), user: { userId: '1', role: Role.ADMIN, email: 'a@b.com' } } as any;
    middleware.isAdmin(req, buildRes(), next);
    expect(next).toHaveBeenCalledTimes(1);
  });
});

// ── isLecturerOrAdmin ────────────────────────────────────────────────────────
describe('AuthMiddleware.isLecturerOrAdmin', () => {
  let next: NextFunction;

  beforeEach(() => {
    next = jest.fn();
  });

  it('calls next() for a lecturer', () => {
    const req = { ...buildReq(), user: { userId: '1', role: Role.LECTURER, email: 'l@b.com' } } as any;
    middleware.isLecturerOrAdmin(req, buildRes(), next);
    expect(next).toHaveBeenCalled();
  });

  it('calls next() for an admin', () => {
    const req = { ...buildReq(), user: { userId: '1', role: Role.ADMIN, email: 'a@b.com' } } as any;
    middleware.isLecturerOrAdmin(req, buildRes(), next);
    expect(next).toHaveBeenCalled();
  });

  it('responds 403 for a student', () => {
    const req = { ...buildReq(), user: { userId: '1', role: Role.STUDENT, email: 's@b.com' } } as any;
    const res = buildRes();
    middleware.isLecturerOrAdmin(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
  });
});

// ── isStudent ─────────────────────────────────────────────────────────────────
describe('AuthMiddleware.isStudent', () => {
  let next: NextFunction;

  beforeEach(() => {
    next = jest.fn();
  });

  it('calls next() for a student', () => {
    const req = { ...buildReq(), user: { userId: '1', role: Role.STUDENT, email: 's@b.com' } } as any;
    middleware.isStudent(req, buildRes(), next);
    expect(next).toHaveBeenCalled();
  });

  it('responds 403 for an admin', () => {
    const req = { ...buildReq(), user: { userId: '1', role: Role.ADMIN, email: 'a@b.com' } } as any;
    const res = buildRes();
    middleware.isStudent(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
  });
});
