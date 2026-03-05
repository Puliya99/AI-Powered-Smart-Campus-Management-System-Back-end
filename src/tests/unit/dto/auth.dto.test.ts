import 'reflect-metadata';
import { validate } from 'class-validator';
import { plainToClass } from 'class-transformer';
import {
  RegisterDto,
  LoginDto,
  ChangePasswordDto,
  ForgotPasswordDto,
  ResetPasswordDto,
} from '../../../dto/auth.dto';
import { Role } from '../../../enums/Role.enum';

// ---------------------------------------------------------------------------
// RegisterDto
// ---------------------------------------------------------------------------
describe('RegisterDto', () => {
  const valid = {
    username: 'johndoe',
    email: 'john@example.com',
    password: 'Password1',
    firstName: 'John',
    lastName: 'Doe',
  };

  it('passes with valid data', async () => {
    const dto = plainToClass(RegisterDto, valid);
    expect(await validate(dto)).toHaveLength(0);
  });

  it('fails when username is shorter than 3 characters', async () => {
    const dto = plainToClass(RegisterDto, { ...valid, username: 'ab' });
    const errors = await validate(dto);
    expect(errors.find(e => e.property === 'username')).toBeDefined();
  });

  it('fails with an invalid email address', async () => {
    const dto = plainToClass(RegisterDto, { ...valid, email: 'not-an-email' });
    const errors = await validate(dto);
    expect(errors.find(e => e.property === 'email')).toBeDefined();
  });

  it('fails when password is shorter than 8 characters', async () => {
    const dto = plainToClass(RegisterDto, { ...valid, password: 'Pa1' });
    const errors = await validate(dto);
    expect(errors.find(e => e.property === 'password')).toBeDefined();
  });

  it('fails when password has no uppercase letter', async () => {
    const dto = plainToClass(RegisterDto, { ...valid, password: 'password1' });
    const errors = await validate(dto);
    expect(errors.find(e => e.property === 'password')).toBeDefined();
  });

  it('fails when password has no lowercase letter', async () => {
    const dto = plainToClass(RegisterDto, { ...valid, password: 'PASSWORD1' });
    const errors = await validate(dto);
    expect(errors.find(e => e.property === 'password')).toBeDefined();
  });

  it('fails when password has no digit', async () => {
    const dto = plainToClass(RegisterDto, { ...valid, password: 'PasswordABC' });
    const errors = await validate(dto);
    expect(errors.find(e => e.property === 'password')).toBeDefined();
  });

  it('fails when firstName is shorter than 2 characters', async () => {
    const dto = plainToClass(RegisterDto, { ...valid, firstName: 'J' });
    const errors = await validate(dto);
    expect(errors.find(e => e.property === 'firstName')).toBeDefined();
  });

  it('fails when lastName is shorter than 2 characters', async () => {
    const dto = plainToClass(RegisterDto, { ...valid, lastName: 'D' });
    const errors = await validate(dto);
    expect(errors.find(e => e.property === 'lastName')).toBeDefined();
  });

  it('accepts an optional valid role enum value', async () => {
    const dto = plainToClass(RegisterDto, { ...valid, role: Role.STUDENT });
    expect(await validate(dto)).toHaveLength(0);
  });

  it('fails with an invalid role enum value', async () => {
    const dto = plainToClass(RegisterDto, { ...valid, role: 'SUPERUSER' });
    const errors = await validate(dto);
    expect(errors.find(e => e.property === 'role')).toBeDefined();
  });

  it('passes without role (it is optional)', async () => {
    const dto = plainToClass(RegisterDto, { ...valid });
    expect(await validate(dto)).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// LoginDto
// ---------------------------------------------------------------------------
describe('LoginDto', () => {
  it('passes with valid credentials', async () => {
    const dto = plainToClass(LoginDto, { email: 'john@example.com', password: 'any' });
    expect(await validate(dto)).toHaveLength(0);
  });

  it('fails with an invalid email format', async () => {
    const dto = plainToClass(LoginDto, { email: 'not-an-email', password: 'Password1' });
    const errors = await validate(dto);
    expect(errors.find(e => e.property === 'email')).toBeDefined();
  });

  it('fails with an empty password', async () => {
    const dto = plainToClass(LoginDto, { email: 'john@example.com', password: '' });
    const errors = await validate(dto);
    expect(errors.find(e => e.property === 'password')).toBeDefined();
  });

  it('fails when email is missing', async () => {
    const dto = plainToClass(LoginDto, { password: 'Password1' });
    const errors = await validate(dto);
    expect(errors.find(e => e.property === 'email')).toBeDefined();
  });

  it('fails when password is missing', async () => {
    const dto = plainToClass(LoginDto, { email: 'john@example.com' });
    const errors = await validate(dto);
    expect(errors.find(e => e.property === 'password')).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// ChangePasswordDto
// ---------------------------------------------------------------------------
describe('ChangePasswordDto', () => {
  it('passes with valid data', async () => {
    const dto = plainToClass(ChangePasswordDto, {
      currentPassword: 'OldPassword1',
      newPassword: 'NewPassword1',
    });
    expect(await validate(dto)).toHaveLength(0);
  });

  it('fails when newPassword is shorter than 8 characters', async () => {
    const dto = plainToClass(ChangePasswordDto, {
      currentPassword: 'OldPassword1',
      newPassword: 'Sh0rt',
    });
    const errors = await validate(dto);
    expect(errors.find(e => e.property === 'newPassword')).toBeDefined();
  });

  it('fails when newPassword has no uppercase letter', async () => {
    const dto = plainToClass(ChangePasswordDto, {
      currentPassword: 'OldPassword1',
      newPassword: 'nonewpassword1',
    });
    const errors = await validate(dto);
    expect(errors.find(e => e.property === 'newPassword')).toBeDefined();
  });

  it('fails when newPassword has no digit', async () => {
    const dto = plainToClass(ChangePasswordDto, {
      currentPassword: 'OldPassword1',
      newPassword: 'NoDigitHere',
    });
    const errors = await validate(dto);
    expect(errors.find(e => e.property === 'newPassword')).toBeDefined();
  });

  it('fails when currentPassword is missing', async () => {
    const dto = plainToClass(ChangePasswordDto, { newPassword: 'NewPassword1' });
    const errors = await validate(dto);
    expect(errors.find(e => e.property === 'currentPassword')).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// ForgotPasswordDto
// ---------------------------------------------------------------------------
describe('ForgotPasswordDto', () => {
  it('passes with a valid email', async () => {
    const dto = plainToClass(ForgotPasswordDto, { email: 'reset@example.com' });
    expect(await validate(dto)).toHaveLength(0);
  });

  it('fails with an invalid email', async () => {
    const dto = plainToClass(ForgotPasswordDto, { email: 'invalid' });
    const errors = await validate(dto);
    expect(errors.find(e => e.property === 'email')).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// ResetPasswordDto
// ---------------------------------------------------------------------------
describe('ResetPasswordDto', () => {
  it('passes with valid data', async () => {
    const dto = plainToClass(ResetPasswordDto, {
      token: 'some-reset-token',
      newPassword: 'NewPassword1',
    });
    expect(await validate(dto)).toHaveLength(0);
  });

  it('fails when token is missing', async () => {
    const dto = plainToClass(ResetPasswordDto, { newPassword: 'NewPassword1' });
    const errors = await validate(dto);
    expect(errors.find(e => e.property === 'token')).toBeDefined();
  });

  it('fails when newPassword does not meet complexity requirements', async () => {
    const dto = plainToClass(ResetPasswordDto, {
      token: 'token',
      newPassword: 'weakpassword',
    });
    const errors = await validate(dto);
    expect(errors.find(e => e.property === 'newPassword')).toBeDefined();
  });
});
