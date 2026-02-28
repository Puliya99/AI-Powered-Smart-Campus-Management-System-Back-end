import { Request, Response } from 'express';
import aiService from '../services/ai.service';

export class AiController {
  async predictExamRisk(req: Request, res: Response) {
    try {
      const { studentId, moduleId } = req.body;

      if (!studentId || !moduleId) {
        return res.status(400).json({
          status: 'error',
          message: 'studentId and moduleId are required',
        });
      }

      const prediction = await aiService.predictExamRisk(studentId, moduleId);
      res.json({
        status: 'success',
        message: 'Prediction generated successfully',
        data: prediction,
      });
    } catch (error: any) {
      res.status(500).json({
        status: 'error',
        message: error.message,
      });
    }
  }

  async trainModel(req: Request, res: Response) {
    try {
      const result = await aiService.trainModel();
      res.json({
        status: 'success',
        message: 'Training process completed',
        data: result,
      });
    } catch (error: any) {
      res.status(500).json({
        status: 'error',
        message: error.message,
      });
    }
  }

  async getStudentFeatures(req: Request, res: Response) {
    try {
      const { studentId, moduleId } = req.query;
      if (!studentId || !moduleId) {
        return res.status(400).json({
          status: 'error',
          message: 'studentId and moduleId are required',
        });
      }
      const data = await aiService.getStudentDataForPrediction(
        studentId as string,
        moduleId as string
      );
      res.json({
        status: 'success',
        message: 'Student features retrieved successfully',
        data: data,
      });
    } catch (error: any) {
      res.status(500).json({
        status: 'error',
        message: error.message,
      });
    }
  }

  async getPredictionHistory(req: Request, res: Response) {
    try {
      const { studentId } = req.params;
      if (!studentId) {
        return res.status(400).json({
          status: 'error',
          message: 'studentId is required',
        });
      }
      const history = await aiService.getPredictionHistory(studentId);
      res.json({
        status: 'success',
        message: 'Prediction history retrieved successfully',
        data: history,
      });
    } catch (error: any) {
      res.status(500).json({
        status: 'error',
        message: error.message,
      });
    }
  }

  async processMaterial(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const result = await aiService.processLectureMaterial(id);
      res.json({
        status: 'success',
        message: 'Material processed successfully',
        data: result,
      });
    } catch (error: any) {
      res.status(500).json({
        status: 'error',
        message: error.message,
      });
    }
  }

  async askQuestion(req: Request, res: Response) {
    try {
      const { courseId, question } = req.body;
      if (!courseId || !question) {
        return res.status(400).json({
          status: 'error',
          message: 'courseId and question are required',
        });
      }
      const result = await aiService.askQuestion(courseId, question);
      res.json({
        status: 'success',
        data: result,
      });
    } catch (error: any) {
      res.status(500).json({
        status: 'error',
        message: error.message,
      });
    }
  }
}

export default new AiController();
