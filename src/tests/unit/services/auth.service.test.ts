import 'reflect-metadata';

// ── Mocks (hoisted) ───────────────────────────────────────────────────────────
jest.mock('../../../config/database', () => ({
  AppDataSource: { getRepository: jest.fn() },
}));

jest.mock('../../../config/env', () => ({
  env: { JWT_SECRET: 'unit-test-secret-32-chars-minimum!', JWT_EXPIRE: '1h' },
}));

jest.mock('../../../services/email.service', () => ({
  default: {
    sendAccountCreationEmail: jest.fn().mockResolvedValue(undefined),
    sendPasswordChangedEmail: jest.fn().mockResolvedValue(undefined),
  },
}));

// ── Imports ───────────────────────────────────────────────────────────────────
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import authService from '../../../services/auth.service';
import { Role } from '../../../enums/Role.enum';

// ── Shared mock repository ─────────────────────────────────────────────────
const mockRepo = {
  findOne: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  createQueryBuilder: jest.fn(),
};

// Inject the mock repository directly into the service instance
// (bypasses class-property initialisation that captured the mock at load time)
beforeEach(() => {
  jest.clearAllMocks();
  (authService as any).userRepository = mockRepo;
});

// ── Helper: build a chainable queryBuilder mock ───────────────────────────────
function qb(resolvedValue: any) {
  const mock = {
    addSelect: jest.fn().mockReturnThis(),
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    getOne: jest.fn().mockResolvedValue(resolvedValue),
  };
  mockRepo.createQueryBuilder.mockReturnValue(mock);
  return mock;
}

// ── register ─────────────────────────────────────────────────────────────────
describe('AuthService.register', () => {
  const input = {
    username: 'testuser',
    email: 'test@example.com',
    password: 'Password1',
    firstName: 'Test',
    lastName: 'User',
  };

  it('throws "Email already registered" when the email already exists', async () => {
    mockRepo.findOne.mockResolvedValue({ email: input.email, username: 'other' });

    await expect(authService.register(input as any)).rejects.toThrow('Email already registered');
  });

  it('throws "Username already taken" when the username already exists', async () => {
    mockRepo.findOne.mockResolvedValue({ email: 'other@test.com', username: input.username });

    await expect(authService.register(input as any)).rejects.toThrow('Username already taken');
  });

  it('creates the user, returns user without password, and returns a valid JWT', async () => {
    mockRepo.findOne.mockResolvedValue(null);
    qb(null); // registration-number query returns null → first user

    const storedUser = {
      id: 'uuid-1',
      ...input,
      password: 'hashed',
      role: Role.STUDENT,
      registrationNumber: 'REG20260001',
      isActive: true,
    };
    mockRepo.create.mockReturnValue(storedUser);
    mockRepo.save.mockResolvedValue(storedUser);

    const result = await authService.register(input as any);

    expect(mockRepo.save).toHaveBeenCalledTimes(1);
    expect(result.user).not.toHaveProperty('password');
    expect(result.token).toBeDefined();

    const decoded = jwt.verify(result.token, 'unit-test-secret-32-chars-minimum!') as any;
    expect(decoded.userId).toBe('uuid-1');
    expect(decoded.role).toBe(Role.STUDENT);
  });

  it('assigns STUDENT role by default when no role is provided', async () => {
    mockRepo.findOne.mockResolvedValue(null);
    qb(null);

    const storedUser = { id: 'u2', ...input, password: 'h', role: Role.STUDENT };
    mockRepo.create.mockReturnValue(storedUser);
    mockRepo.save.mockResolvedValue(storedUser);

    await authService.register(input as any);

    const createCall = mockRepo.create.mock.calls[0][0];
    expect(createCall.role).toBe(Role.STUDENT);
  });

  it('generates an incremented registration number when previous users exist', async () => {
    mockRepo.findOne.mockResolvedValue(null);
    const year = new Date().getFullYear();
    qb({ registrationNumber: `REG${year}0003` });

    const storedUser = { id: 'u3', ...input, password: 'h', role: Role.STUDENT };
    mockRepo.create.mockReturnValue(storedUser);
    mockRepo.save.mockResolvedValue(storedUser);

    await authService.register(input as any);

    const createCall = mockRepo.create.mock.calls[0][0];
    expect(createCall.registrationNumber).toBe(`REG${year}0004`);
  });

  it('still returns a result even when the email service throws', async () => {
    mockRepo.findOne.mockResolvedValue(null);
    qb(null);

    const storedUser = { id: 'u4', ...input, password: 'h', role: Role.STUDENT };
    mockRepo.create.mockReturnValue(storedUser);
    mockRepo.save.mockResolvedValue(storedUser);

    const emailService = require('../../../services/email.service').default;
    emailService.sendAccountCreationEmail.mockRejectedValue(new Error('SMTP down'));

    const result = await authService.register(input as any);
    expect(result.user).toBeDefined();
  });
});

// ── login ─────────────────────────────────────────────────────────────────────
describe('AuthService.login', () => {
  it('throws "Invalid email or password" when the user is not found', async () => {
    qb(null);

    await expect(
      authService.login({ email: 'nobody@test.com', password: 'any' }),
    ).rejects.toThrow('Invalid email or password');
  });

  it('throws "Account is inactive" when the account is disabled', async () => {
    qb({ id: 'u1', email: 'test@test.com', password: 'hash', isActive: false });

    await expect(
      authService.login({ email: 'test@test.com', password: 'any' }),
    ).rejects.toThrow('Account is inactive');
  });

  it('throws "Invalid email or password" when the password is wrong', async () => {
    const hash = await bcrypt.hash('correct', 10);
    qb({ id: 'u1', email: 'test@test.com', password: hash, isActive: true });

    await expect(
      authService.login({ email: 'test@test.com', password: 'wrong' }),
    ).rejects.toThrow('Invalid email or password');
  });

  it('returns user without password and a valid JWT on successful login', async () => {
    const hash = await bcrypt.hash('Password1', 10);
    qb({ id: 'u1', email: 'test@test.com', password: hash, isActive: true, role: Role.STUDENT });

    const result = await authService.login({ email: 'test@test.com', password: 'Password1' });

    expect(result.user).not.toHaveProperty('password');
    expect(result.token).toBeDefined();

    const decoded = jwt.verify(result.token, 'unit-test-secret-32-chars-minimum!') as any;
    expect(decoded.userId).toBe('u1');
  });
});

// ── getCurrentUser ────────────────────────────────────────────────────────────
describe('AuthService.getCurrentUser', () => {
  it('throws "User not found" when user does not exist', async () => {
    mockRepo.findOne.mockResolvedValue(null);

    await expect(authService.getCurrentUser('nonexistent')).rejects.toThrow('User not found');
  });

  it('returns the user when found', async () => {
    const user = { id: 'u1', email: 'test@test.com', role: Role.STUDENT };
    mockRepo.findOne.mockResolvedValue(user);

    const result = await authService.getCurrentUser('u1');
    expect(result).toEqual(user);
    expect(mockRepo.findOne).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'u1' } }),
    );
  });
});

// ── changePassword ────────────────────────────────────────────────────────────
describe('AuthService.changePassword', () => {
  it('throws "User not found" when user does not exist', async () => {
    qb(null);

    await expect(
      authService.changePassword('u1', { currentPassword: 'any', newPassword: 'NewPassword1' }),
    ).rejects.toThrow('User not found');
  });

  it('throws "Current password is incorrect" on wrong current password', async () => {
    const hash = await bcrypt.hash('correct', 10);
    qb({ id: 'u1', password: hash, email: 'a@b.com', firstName: 'A' });

    await expect(
      authService.changePassword('u1', { currentPassword: 'wrong', newPassword: 'NewPassword1' }),
    ).rejects.toThrow('Current password is incorrect');
  });

  it('saves the new password and returns a success message', async () => {
    const hash = await bcrypt.hash('OldPassword1', 10);
    const user = { id: 'u1', password: hash, email: 'a@b.com', firstName: 'A' };
    qb(user);
    mockRepo.save.mockResolvedValue({ ...user, password: 'newHash' });

    const result = await authService.changePassword('u1', {
      currentPassword: 'OldPassword1',
      newPassword: 'NewPassword1',
    });

    expect(mockRepo.save).toHaveBeenCalledTimes(1);
    expect(result.message).toBe('Password changed successfully');
  });
});

// ── updateProfile ─────────────────────────────────────────────────────────────
describe('AuthService.updateProfile', () => {
  it('throws "User not found" when user does not exist', async () => {
    mockRepo.findOne.mockResolvedValue(null);

    await expect(
      authService.updateProfile('u1', { firstName: 'New' }),
    ).rejects.toThrow('User not found');
  });

  it('updates allowed fields and returns user without password', async () => {
    const user: any = {
      id: 'u1',
      firstName: 'Old',
      lastName: 'Name',
      password: 'hash',
      email: 'a@b.com',
    };
    mockRepo.findOne.mockResolvedValue(user);
    mockRepo.save.mockImplementation(async (u: any) => u);

    const result = await authService.updateProfile('u1', { firstName: 'New' });

    expect(result).not.toHaveProperty('password');
    expect((result as any).firstName).toBe('New');
  });

  it('ignores fields not in the allowedFields list', async () => {
    const user: any = { id: 'u1', firstName: 'A', lastName: 'B', password: 'h', role: 'STUDENT' };
    mockRepo.findOne.mockResolvedValue(user);
    mockRepo.save.mockImplementation(async (u: any) => u);

    await authService.updateProfile('u1', { role: 'ADMIN' });

    // role is not in allowedFields so should remain STUDENT
    expect(user.role).toBe('STUDENT');
  });
});

// ── logout ────────────────────────────────────────────────────────────────────
describe('AuthService.logout', () => {
  it('returns a success message', async () => {
    const result = await authService.logout();
    expect(result.message).toBe('Logged out successfully');
  });
});
