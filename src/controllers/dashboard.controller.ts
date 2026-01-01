import { Request, Response } from 'express';
import dashboardService from '../services/dashboard.service';

export class DashboardController {
  // Get dashboard data based on user role
  async getDashboard(req: Request, res: Response) {
    try {
      const userId = (req as any).user.userId;
      const userRole = (req as any).user.role;

      let dashboardData;

      switch (userRole) {
        case 'ADMIN':
          dashboardData = await dashboardService.getAdminDashboard();
          break;
        case 'STUDENT':
          dashboardData = await dashboardService.getStudentDashboard(userId);
          break;
        case 'LECTURER':
          dashboardData = await dashboardService.getLecturerDashboard(userId);
          break;
        case 'USER': // Staff
          dashboardData = await dashboardService.getStaffDashboard(userId);
          break;
        default:
          return res.status(403).json({
            status: 'error',
            message: 'Invalid user role',
          });
      }

      res.json({
        status: 'success',
        data: dashboardData,
      });
    } catch (error: any) {
      res.status(500).json({
        status: 'error',
        message: error.message || 'Failed to fetch dashboard data',
      });
    }
  }

  // Get admin dashboard
  async getAdminDashboard(req: Request, res: Response) {
    try {
      const data = await dashboardService.getAdminDashboard();

      res.json({
        status: 'success',
        data,
      });
    } catch (error: any) {
      res.status(500).json({
        status: 'error',
        message: error.message || 'Failed to fetch admin dashboard',
      });
    }
  }

  // Get student dashboard
  async getStudentDashboard(req: Request, res: Response) {
    try {
      const userId = (req as any).user.userId;
      const data = await dashboardService.getStudentDashboard(userId);

      res.json({
        status: 'success',
        data,
      });
    } catch (error: any) {
      res.status(500).json({
        status: 'error',
        message: error.message || 'Failed to fetch student dashboard',
      });
    }
  }

  // Get lecturer dashboard
  async getLecturerDashboard(req: Request, res: Response) {
    try {
      const userId = (req as any).user.userId;
      const data = await dashboardService.getLecturerDashboard(userId);

      res.json({
        status: 'success',
        data,
      });
    } catch (error: any) {
      res.status(500).json({
        status: 'error',
        message: error.message || 'Failed to fetch lecturer dashboard',
      });
    }
  }

  // Get staff dashboard
  async getStaffDashboard(req: Request, res: Response) {
    try {
      const userId = (req as any).user.userId;
      const data = await dashboardService.getStaffDashboard(userId);

      res.json({
        status: 'success',
        data,
      });
    } catch (error: any) {
      res.status(500).json({
        status: 'error',
        message: error.message || 'Failed to fetch staff dashboard',
      });
    }
  }
}

export default new DashboardController();
