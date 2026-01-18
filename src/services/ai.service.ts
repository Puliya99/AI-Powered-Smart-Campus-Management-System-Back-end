import { AppDataSource } from '../config/database';
import { Student } from '../entities/Student.entity';
import { Attendance } from '../entities/Attendance.entity';
import { Result } from '../entities/Result.entity';
import { QuizAttempt } from '../entities/QuizAttempt.entity';
import { QuizViolation } from '../entities/QuizViolation.entity';
import { Submission } from '../entities/Submission.entity';
import { Payment } from '../entities/Payment.entity';
import { Enrollment } from '../entities/Enrollment.entity';
import { Module } from '../entities/Module.entity';
import { AttendanceStatus } from '../enums/AttendanceStatus.enum';
import { ResultStatus } from '../enums/ResultStatus.enum';
import { PaymentStatus } from '../enums/PaymentStatus.enum';

import { Prediction } from '../entities/Prediction.entity';
import { RiskLevel } from '../enums/RiskLevel.enum';
import axios from 'axios';

export class AiService {
  private studentRepository = AppDataSource.getRepository(Student);
  private attendanceRepository = AppDataSource.getRepository(Attendance);
  private resultRepository = AppDataSource.getRepository(Result);
  private quizAttemptRepository = AppDataSource.getRepository(QuizAttempt);
  private quizViolationRepository = AppDataSource.getRepository(QuizViolation);
  private submissionRepository = AppDataSource.getRepository(Submission);
  private paymentRepository = AppDataSource.getRepository(Payment);
  private enrollmentRepository = AppDataSource.getRepository(Enrollment);
  private predictionRepository = AppDataSource.getRepository(Prediction);
  private moduleRepository = AppDataSource.getRepository(Module);

  private readonly AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:8001';

  async predictExamRisk(studentId: string, moduleId: string) {
    const data = await this.getStudentDataForPrediction(studentId, moduleId);

    try {
      const response = await axios.post(`${this.AI_SERVICE_URL}/predict`, data);
      const predictionData = response.data;

      // Save prediction to database
      const prediction = new Prediction();
      prediction.student = { id: studentId } as Student;
      prediction.predictionType = 'EXAM_FAILURE_RISK';
      prediction.riskScore = predictionData.risk_score * 100;
      prediction.riskLevel = predictionData.risk_level as RiskLevel;
      prediction.factors = { reasons: predictionData.reasons };
      prediction.modelVersion = predictionData.version;
      prediction.predictionDate = new Date();
      prediction.recommendation = this.generateRecommendation(predictionData.risk_level, predictionData.reasons);

      await this.predictionRepository.save(prediction);

      return prediction;
    } catch (error) {
      console.error('Error calling AI service:', error);
      throw new Error('Failed to get prediction from AI service');
    }
  }

  private generateRecommendation(riskLevel: string, reasons: string[]): string {
    if (riskLevel === 'LOW') {
      return 'Keep up the good work! Maintain your current study habits.';
    }
    
    let recommendation = 'We recommend the following actions: ';
    if (reasons.includes('Low attendance')) {
      recommendation += 'Attend more lectures and engage with course materials. ';
    }
    if (reasons.includes('Low quiz performance')) {
      recommendation += 'Review previous quiz topics and participate in extra tutorials. ';
    }
    if (reasons.includes('Low assignment scores')) {
      recommendation += 'Focus on improving assignment quality and meet with the lecturer if needed. ';
    }
    
    if (riskLevel === 'HIGH') {
      recommendation = 'URGENT: ' + recommendation + 'Please schedule a meeting with your academic advisor.';
    }

    return recommendation;
  }

  async trainModel() {
    // In a real scenario, we'd fetch historical data for many students
    // For now, let's fetch data for students who already have exam results
    const results = await this.resultRepository.find({
      relations: ['student', 'module']
    });

    const trainingData = [];
    for (const result of results) {
      const data = await this.getStudentDataForPrediction(result.student.id, result.module.id, true);
      trainingData.push({
        ...data,
        exam_result: result.status === ResultStatus.FAIL ? 1 : 0
      });
    }

    if (trainingData.length < 10) {
      return { status: 'error', message: 'Not enough historical data to train the model' };
    }

    try {
      const response = await axios.post(`${this.AI_SERVICE_URL}/train`, trainingData);
      return response.data;
    } catch (error) {
      console.error('Error training AI model:', error);
      throw new Error('Failed to train AI model');
    }
  }

  async getStudentDataForPrediction(studentId: string, moduleId: string, isHistorical: boolean = false) {
    const student = await this.studentRepository.findOne({
      where: { id: studentId },
      relations: ['user']
    });

    if (!student) {
      throw new Error('Student not found');
    }

    // A. Student Academic Data
    const results = await this.resultRepository.find({
      where: { student: { id: studentId } },
      relations: ['module']
    });

    const moduleResults = results.filter(r => r.module && r.module.id === moduleId);
    
    // If we're getting data for a specific module's training, we use THAT module's 
    // performance data but we MUST NOT use the final exam result as a feature.
    // However, our features are attendance, assignments, quizzes which happen BEFORE final exam.
    
    const otherResults = results.filter(r => r.module && r.module.id !== moduleId);

    const previousExamScore = otherResults.length > 0
      ? otherResults.reduce((acc, r) => acc + (r.marks / r.maxMarks) * 100, 0) / otherResults.length
      : 0;

    const gpa = results.length > 0
      ? results.reduce((acc, r) => acc + (r.marks / r.maxMarks) * 4.0, 0) / results.length
      : 0;

    // B. Attendance Data
    const attendances = await this.attendanceRepository.find({
      where: { 
        student: { id: studentId },
        schedule: { module: { id: moduleId } }
      },
      relations: ['schedule', 'schedule.module']
    });

    const totalClasses = attendances.length;
    const classesMissed = attendances.filter(a => a.status === AttendanceStatus.ABSENT).length;
    const attendancePercentage = totalClasses > 0 
      ? ((totalClasses - classesMissed) / totalClasses) * 100 
      : 100;

    // C. Assignment Data
    const submissions = await this.submissionRepository.find({
      where: { 
        student: { id: studentId },
        assignment: { module: { id: moduleId } }
      },
      relations: ['assignment']
    });

    const averageAssignmentScore = submissions.length > 0
      ? submissions.reduce((acc, s) => acc + (Number(s.marks) || 0), 0) / submissions.length
      : 0;

    const lateSubmissions = submissions.filter(s => {
        if (!s.submittedAt || !s.assignment.dueDate) return false;
        return new Date(s.submittedAt) > new Date(s.assignment.dueDate);
    }).length;

    // D. Quiz Data
    const quizAttempts = await this.quizAttemptRepository.find({
      where: { 
        student: { id: studentId },
        quiz: { module: { id: moduleId } }
      },
      relations: ['quiz']
    });

    const quizAverage = quizAttempts.length > 0
      ? quizAttempts.reduce((acc, a) => acc + (Number(a.score) || 0), 0) / quizAttempts.length
      : 0;

    const quizAttemptsCount = quizAttempts.length;

    // E. Face Violations
    let faceViolationCount = 0;
    for (const attempt of quizAttempts) {
      const violations = await this.quizViolationRepository.count({
        where: { attempt: { id: attempt.id } }
      });
      faceViolationCount += violations;
    }

    // F. Financial Data
    const payments = await this.paymentRepository.find({
      where: { student: { id: studentId } }
    });
    
    const overduePayments = payments.filter(p => p.status === PaymentStatus.PENDING && p.nextPaymentDate && new Date(p.nextPaymentDate) < new Date());
    const paymentDelayDays = overduePayments.length > 0
      ? Math.max(...overduePayments.map(p => {
          const diff = new Date().getTime() - new Date(p.nextPaymentDate!).getTime();
          return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));
        }))
      : 0;

    const gpa_val = Number(gpa) || 0;
    const previousExamScore_val = Number(previousExamScore) || 0;

    return {
      student_id: student.id,
      subject_id: moduleId,
      attendance_percentage: attendancePercentage || 0,
      average_assignment_score: averageAssignmentScore || 0,
      quiz_average: quizAverage || 0,
      gpa: gpa_val,
      classes_missed: classesMissed || 0,
      late_submissions: lateSubmissions || 0,
      quiz_attempts: quizAttemptsCount || 0,
      face_violation_count: faceViolationCount || 0,
      payment_delay_days: paymentDelayDays || 0,
      previous_exam_score: previousExamScore_val
    };
  }

  async getPredictionHistory(studentId: string) {
    return await this.predictionRepository.find({
      where: { student: { id: studentId } },
      order: { createdAt: 'DESC' }
    });
  }

  async runBatchPredictions() {
    console.log('🚀 Starting batch examination risk predictions...');
    
    // Auto-train model if enough data exists and it's the first time
    try {
        await this.trainModel();
    } catch (e) {
        console.log('Skipping auto-training: not enough data or AI service unreachable');
    }

    const enrollments = await this.enrollmentRepository.find({
      relations: ['student', 'batch', 'batch.program']
    });

    let count = 0;
    for (const enrollment of enrollments) {
      // Find modules for this enrollment's program or batch
      const modules = await this.moduleRepository.find({
        where: { program: { id: enrollment.batch.program.id } }
      });

      for (const module of modules) {
        try {
          await this.predictExamRisk(enrollment.student.id, module.id);
          count++;
        } catch (error) {
          console.error(`Failed prediction for student ${enrollment.student.id} in module ${module.id}`);
        }
      }
    }
    console.log(`✅ Batch predictions completed. Generated ${count} predictions.`);
    return { generated: count };
  }
}

export default new AiService();
