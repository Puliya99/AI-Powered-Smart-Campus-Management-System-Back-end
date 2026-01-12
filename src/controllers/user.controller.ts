import { Request, Response } from 'express';
import userService from '../services/user.service';

export class UserController {
  // Get all users
  async getAllUsers(req: Request, res: Response) {
    try {
      const { page, limit, search, role, isActive, centerId } = req.query;
      const result = await userService.getAllUsers({
        page: page ? Number(page) : undefined,
        limit: limit ? Number(limit) : undefined,
        search: search as string,
        role: role as any,
        isActive: isActive !== undefined ? isActive === 'true' : undefined,
        centerId: centerId as string,
      });

      res.json({
        status: 'success',
        data: result,
      });
    } catch (error: any) {
      res.status(500).json({
        status: 'error',
        message: error.message || 'Failed to fetch users',
      });
    }
  }

  // Get user by ID
  async getUserById(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const user = await userService.getUserById(id);

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

  // Create new user
  async createUser(req: Request, res: Response) {
    try {
      const user = await userService.createUser(req.body);

      res.status(201).json({
        status: 'success',
        message: 'User created successfully',
        data: { user },
      });
    } catch (error: any) {
      res.status(400).json({
        status: 'error',
        message: error.message || 'Failed to create user',
      });
    }
  }

  // Update user
  async updateUser(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const user = await userService.updateUser(id, req.body);

      res.json({
        status: 'success',
        message: 'User updated successfully',
        data: { user },
      });
    } catch (error: any) {
      res.status(400).json({
        status: 'error',
        message: error.message || 'Failed to update user',
      });
    }
  }

  // Delete user
  async deleteUser(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const result = await userService.deleteUser(id);

      res.json({
        status: 'success',
        message: result.message,
      });
    } catch (error: any) {
      res.status(400).json({
        status: 'error',
        message: error.message || 'Failed to delete user',
      });
    }
  }

  // Get user statistics
  async getUserStats(req: Request, res: Response) {
    try {
      const stats = await userService.getUserStats();

      res.json({
        status: 'success',
        data: stats,
      });
    } catch (error: any) {
      res.status(500).json({
        status: 'error',
        message: error.message || 'Failed to fetch user stats',
      });
    }
  }
}

export default new UserController();
