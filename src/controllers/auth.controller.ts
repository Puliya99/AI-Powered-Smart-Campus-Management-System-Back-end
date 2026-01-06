import { Request, Response } from 'express';
import authService from '../services/auth.service';
import { RegisterDto, LoginDto, ChangePasswordDto } from '../dto/auth.dto';
import { validate } from 'class-validator';
import { plainToClass } from 'class-transformer';

export class AuthController {
  // Register
  async register(req: Request, res: Response) {
    try {
      // Validate DTO
      const registerDto = plainToClass(RegisterDto, req.body);
      const errors = await validate(registerDto);

      if (errors.length > 0) {
        return res.status(400).json({
          status: 'error',
          message: 'Validation failed',
          errors: errors.map(err => ({
            field: err.property,
            messages: Object.values(err.constraints || {}),
          })),
        });
      }

      const result = await authService.register(registerDto);

      res.status(201).json({
        status: 'success',
        message: 'User registered successfully',
        data: result,
      });
    } catch (error: any) {
      res.status(400).json({
        status: 'error',
        message: error.message || 'Registration failed',
      });
    }
  }

  // Login
  async login(req: Request, res: Response) {
    try {
      // Validate DTO
      const loginDto = plainToClass(LoginDto, req.body);
      const errors = await validate(loginDto);

      if (errors.length > 0) {
        return res.status(400).json({
          status: 'error',
          message: 'Validation failed',
          errors: errors.map(err => ({
            field: err.property,
            messages: Object.values(err.constraints || {}),
          })),
        });
      }

      const result = await authService.login(loginDto);

      res.json({
        status: 'success',
        message: 'Login successful',
        data: result,
      });
    } catch (error: any) {
      res.status(401).json({
        status: 'error',
        message: error.message || 'Login failed',
      });
    }
  }

  // Get current user
  async getCurrentUser(req: Request, res: Response) {
    try {
      const userId = (req as any).user.userId;
      const user = await authService.getCurrentUser(userId);

      res.json({
        status: 'success',
        data: { user },
      });
    } catch (error: any) {
      res.status(404).json({
        status: 'error',
        message: error.message || 'User not found',
      });
    }
  }

  // Change password
  async changePassword(req: Request, res: Response) {
    try {
      const userId = (req as any).user.userId;
      const changePasswordDto = plainToClass(ChangePasswordDto, req.body);
      const errors = await validate(changePasswordDto);

      if (errors.length > 0) {
        return res.status(400).json({
          status: 'error',
          message: 'Validation failed',
          errors: errors.map(err => ({
            field: err.property,
            messages: Object.values(err.constraints || {}),
          })),
        });
      }

      const result = await authService.changePassword(userId, changePasswordDto);

      res.json({
        status: 'success',
        message: result.message,
      });
    } catch (error: any) {
      res.status(400).json({
        status: 'error',
        message: error.message || 'Password change failed',
      });
    }
  }

  // Update profile
  async updateProfile(req: Request, res: Response) {
    try {
      const userId = (req as any).user.userId;
      const user = await authService.updateProfile(userId, req.body);

      res.json({
        status: 'success',
        message: 'Profile updated successfully',
        data: { user },
      });
    } catch (error: any) {
      res.status(400).json({
        status: 'error',
        message: error.message || 'Profile update failed',
      });
    }
  }

  // Logout
  async logout(req: Request, res: Response) {
    try {
      const result = await authService.logout();

      res.json({
        status: 'success',
        message: result.message,
      });
    } catch (error: any) {
      res.status(400).json({
        status: 'error',
        message: error.message || 'Logout failed',
      });
    }
  }
}

export default new AuthController();
