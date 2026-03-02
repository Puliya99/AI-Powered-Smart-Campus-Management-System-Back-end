import { Request, Response } from 'express';
import axios from 'axios';
import { env } from '../config/env';

class FaceController {
  private get aiServiceUrl(): string {
    return env.AI_SERVICE_URL || 'http://localhost:8000';
  }

  async enrollFace(req: Request, res: Response) {
    try {
      const userId = (req as any).user.userId;
      const { image } = req.body;

      if (!image) {
        return res.status(400).json({
          status: 'error',
          message: 'Image is required',
        });
      }

      const response = await axios.post(
        `${this.aiServiceUrl}/api/face/enroll`,
        { student_id: userId, image },
        { timeout: 30000 }
      );

      res.json({
        status: 'success',
        data: response.data,
      });
    } catch (error: any) {
      const status = error.response?.status || 500;
      const message =
        error.response?.data?.detail || error.message || 'Face enrollment failed';
      res.status(status).json({ status: 'error', message });
    }
  }

  async verifyFace(req: Request, res: Response) {
    try {
      const userId = (req as any).user.userId;
      const { image } = req.body;

      if (!image) {
        return res.status(400).json({
          status: 'error',
          message: 'Image is required',
        });
      }

      const response = await axios.post(
        `${this.aiServiceUrl}/api/face/verify`,
        { student_id: userId, image },
        { timeout: 30000 }
      );

      res.json({
        status: 'success',
        data: response.data,
      });
    } catch (error: any) {
      const status = error.response?.status || 500;
      const message =
        error.response?.data?.detail || error.message || 'Face verification failed';
      res.status(status).json({ status: 'error', message });
    }
  }

  async livenessCheck(req: Request, res: Response) {
    try {
      const userId = (req as any).user.userId;
      const { challenge_type, challenge_param, frames } = req.body;

      if (!challenge_type || !challenge_param || !frames || !Array.isArray(frames)) {
        return res.status(400).json({
          status: 'error',
          message: 'challenge_type, challenge_param, and frames are required',
        });
      }

      const response = await axios.post(
        `${this.aiServiceUrl}/api/face/liveness-check`,
        { student_id: userId, challenge_type, challenge_param, frames },
        { timeout: 60000 }
      );

      res.json({
        status: 'success',
        data: response.data,
      });
    } catch (error: any) {
      const status = error.response?.status || 500;
      const message =
        error.response?.data?.detail || error.message || 'Liveness check failed';
      res.status(status).json({ status: 'error', message });
    }
  }

  async checkEnrollment(req: Request, res: Response) {
    try {
      const { studentId } = req.params;

      const response = await axios.get(
        `${this.aiServiceUrl}/api/face/check/${studentId}`,
        { timeout: 10000 }
      );

      res.json({
        status: 'success',
        data: response.data,
      });
    } catch (error: any) {
      const status = error.response?.status || 500;
      const message =
        error.response?.data?.detail || error.message || 'Enrollment check failed';
      res.status(status).json({ status: 'error', message });
    }
  }
}

const faceController = new FaceController();
export default faceController;
