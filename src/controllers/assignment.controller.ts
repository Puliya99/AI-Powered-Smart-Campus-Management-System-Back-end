import { Request, Response } from 'express';
import { AppDataSource } from '../config/database';
import { Assignment } from '../entities/Assignment.entity';
import { Submission } from '../entities/Submission.entity';
import { Module } from '../entities/Module.entity';
import { Lecturer } from '../entities/Lecturer.entity';
import { Student } from '../entities/Student.entity';
import { Enrollment } from '../entities/Enrollment.entity';
import { Role } from '../enums/Role.enum';
import { SubmissionStatus } from '../enums/SubmissionStatus.enum';
import path from 'path';
import fs from 'fs';

export class AssignmentController {
  private assignmentRepository = AppDataSource.getRepository(Assignment);
  private submissionRepository = AppDataSource.getRepository(Submission);
  private moduleRepository = AppDataSource.getRepository(Module);
  private lecturerRepository = AppDataSource.getRepository(Lecturer);
  private studentRepository = AppDataSource.getRepository(Student);
  private enrollmentRepository = AppDataSource.getRepository(Enrollment);

  // Get assignments for a module
  async getAssignmentsByModule(req: Request, res: Response) {
    try {
      const { moduleId } = req.params;
      const user = (req as any).user;

      if (user.role === Role.STUDENT) {
        const student = await this.studentRepository.findOne({
          where: { user: { id: user.userId } },
        });

        if (!student) {
          return res.status(403).json({ status: 'error', message: 'Student profile not found' });
        }

        const module = await this.moduleRepository.findOne({
          where: { id: moduleId },
          relations: ['program'],
        });

        if (!module) {
          return res.status(404).json({ status: 'error', message: 'Module not found' });
        }

        const enrollment = await this.enrollmentRepository.findOne({
          where: {
            student: { id: student.id },
            program: { id: module.program.id },
            status: 'ACTIVE' as any,
          },
        });

        if (!enrollment) {
          return res.status(403).json({ status: 'error', message: 'You are not enrolled in the program for this module' });
        }

        // Fetch assignments with student's submissions
        const assignments = await this.assignmentRepository.find({
          where: { module: { id: moduleId } },
          relations: ['lecturer', 'lecturer.user'],
          order: { dueDate: 'ASC' },
        });

        const assignmentsWithSubmissions = await Promise.all(assignments.map(async (assignment) => {
          const submission = await this.submissionRepository.findOne({
            where: { assignment: { id: assignment.id }, student: { id: student.id } }
          });
          return { ...assignment, submission };
        }));

        return res.json({ status: 'success', data: { assignments: assignmentsWithSubmissions } });
      }

      // Lecturer or Admin
      const assignments = await this.assignmentRepository.find({
        where: { module: { id: moduleId } },
        relations: ['lecturer', 'lecturer.user'],
        order: { dueDate: 'ASC' },
      });

      return res.json({ status: 'success', data: { assignments } });
    } catch (error: any) {
      return res.status(500).json({ status: 'error', message: error.message || 'Failed to fetch assignments' });
    }
  }

  // Get assignment by ID
  async getAssignmentById(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const assignment = await this.assignmentRepository.findOne({
        where: { id },
        relations: ['lecturer', 'lecturer.user', 'module'],
      });

      if (!assignment) {
        return res.status(404).json({ status: 'error', message: 'Assignment not found' });
      }

      return res.json({ status: 'success', data: { assignment } });
    } catch (error: any) {
      return res.status(500).json({ status: 'error', message: error.message || 'Failed to fetch assignment' });
    }
  }

  // Create assignment (Lecturer only)
  async createAssignment(req: Request, res: Response) {
    try {
      const { title, description, moduleId, dueDate } = req.body;
      let fileUrl = req.body.fileUrl;
      const user = (req as any).user;

      if (req.file) {
        fileUrl = `/uploads/${req.file.filename}`;
      }

      const lecturer = await this.lecturerRepository.findOne({
        where: { user: { id: user.userId } },
      });

      if (!lecturer) {
        return res.status(403).json({ status: 'error', message: 'Lecturer profile not found' });
      }

      const module = await this.moduleRepository.findOne({
        where: { id: moduleId },
        relations: ['lecturer'],
      });

      if (!module) {
        return res.status(404).json({ status: 'error', message: 'Module not found' });
      }

      if (module.lecturer.id !== lecturer.id) {
        return res.status(403).json({ status: 'error', message: 'You are not assigned to this module' });
      }

      const assignment = this.assignmentRepository.create({
        title,
        description,
        dueDate: new Date(dueDate),
        fileUrl,
        module,
        lecturer,
      });

      await this.assignmentRepository.save(assignment);

      return res.status(201).json({ status: 'success', message: 'Assignment created successfully', data: { assignment } });
    } catch (error: any) {
      return res.status(400).json({ status: 'error', message: error.message || 'Failed to create assignment' });
    }
  }

  // Update assignment (Lecturer only)
  async updateAssignment(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { title, description, dueDate } = req.body;
      let fileUrl = req.body.fileUrl;
      const user = (req as any).user;

      if (req.file) {
        fileUrl = `/uploads/${req.file.filename}`;
      }

      const assignment = await this.assignmentRepository.findOne({
        where: { id },
        relations: ['lecturer', 'lecturer.user'],
      });

      if (!assignment) {
        return res.status(404).json({ status: 'error', message: 'Assignment not found' });
      }

      if (assignment.lecturer.user.id !== user.userId && user.role !== Role.ADMIN) {
        return res.status(403).json({ status: 'error', message: 'Unauthorized' });
      }

      assignment.title = title || assignment.title;
      assignment.description = description || assignment.description;
      assignment.dueDate = dueDate ? new Date(dueDate) : assignment.dueDate;
      if (fileUrl) assignment.fileUrl = fileUrl;

      await this.assignmentRepository.save(assignment);

      return res.json({ status: 'success', message: 'Assignment updated successfully', data: { assignment } });
    } catch (error: any) {
      return res.status(400).json({ status: 'error', message: error.message || 'Failed to update assignment' });
    }
  }

  // Delete assignment
  async deleteAssignment(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const user = (req as any).user;

      const assignment = await this.assignmentRepository.findOne({
        where: { id },
        relations: ['lecturer', 'lecturer.user'],
      });

      if (!assignment) {
        return res.status(404).json({ status: 'error', message: 'Assignment not found' });
      }

      if (assignment.lecturer.user.id !== user.userId && user.role !== Role.ADMIN) {
        return res.status(403).json({ status: 'error', message: 'Unauthorized' });
      }

      await this.assignmentRepository.remove(assignment);

      return res.json({ status: 'success', message: 'Assignment deleted successfully' });
    } catch (error: any) {
      return res.status(500).json({ status: 'error', message: error.message || 'Failed to delete assignment' });
    }
  }

  // Submit assignment (Student only)
  async submitAssignment(req: Request, res: Response) {
    try {
      const { assignmentId } = req.params;
      const user = (req as any).user;

      if (!req.file) {
        return res.status(400).json({ status: 'error', message: 'Please upload a file' });
      }

      const student = await this.studentRepository.findOne({
        where: { user: { id: user.userId } },
      });

      if (!student) {
        return res.status(403).json({ status: 'error', message: 'Student profile not found' });
      }

      const assignment = await this.assignmentRepository.findOne({
        where: { id: assignmentId },
      });

      if (!assignment) {
        return res.status(404).json({ status: 'error', message: 'Assignment not found' });
      }

      // Check if already submitted
      let submission = await this.submissionRepository.findOne({
        where: { assignment: { id: assignmentId }, student: { id: student.id } }
      });

      const now = new Date();
      const isLate = now > assignment.dueDate;

      if (submission) {
        // Update existing submission
        submission.fileUrl = `/uploads/${req.file.filename}`;
        submission.submittedAt = now;
        submission.isLate = isLate;
        submission.status = isLate ? SubmissionStatus.LATE_SUBMISSION : SubmissionStatus.SUBMITTED;
      } else {
        // Create new submission
        submission = this.submissionRepository.create({
          assignment,
          student,
          fileUrl: `/uploads/${req.file.filename}`,
          submittedAt: now,
          isLate,
          status: isLate ? SubmissionStatus.LATE_SUBMISSION : SubmissionStatus.SUBMITTED,
        });
      }

      await this.submissionRepository.save(submission);

      return res.status(201).json({ status: 'success', message: 'Assignment submitted successfully', data: { submission } });
    } catch (error: any) {
      return res.status(400).json({ status: 'error', message: error.message || 'Failed to submit assignment' });
    }
  }

  // Get submissions for an assignment (Lecturer only)
  async getSubmissionsByAssignment(req: Request, res: Response) {
    try {
      const { assignmentId } = req.params;
      const user = (req as any).user;

      const assignment = await this.assignmentRepository.findOne({
        where: { id: assignmentId },
        relations: ['lecturer', 'lecturer.user'],
      });

      if (!assignment) {
        return res.status(404).json({ status: 'error', message: 'Assignment not found' });
      }

      if (assignment.lecturer.user.id !== user.userId && user.role !== Role.ADMIN) {
        return res.status(403).json({ status: 'error', message: 'Unauthorized' });
      }

      const submissions = await this.submissionRepository.find({
        where: { assignment: { id: assignmentId } },
        relations: ['student', 'student.user'],
        order: { submittedAt: 'DESC' },
      });

      return res.json({ status: 'success', data: { submissions } });
    } catch (error: any) {
      return res.status(500).json({ status: 'error', message: error.message || 'Failed to fetch submissions' });
    }
  }

  // Mark submission (Lecturer only)
  async markSubmission(req: Request, res: Response) {
    try {
      const { id } = req.params; // Submission ID
      const { marks, feedback } = req.body;
      const user = (req as any).user;

      const submission = await this.submissionRepository.findOne({
        where: { id },
        relations: ['assignment', 'assignment.lecturer', 'assignment.lecturer.user'],
      });

      if (!submission) {
        return res.status(404).json({ status: 'error', message: 'Submission not found' });
      }

      if (submission.assignment.lecturer.user.id !== user.userId && user.role !== Role.ADMIN) {
        return res.status(403).json({ status: 'error', message: 'Unauthorized' });
      }

      submission.marks = marks;
      submission.feedback = feedback;
      await this.submissionRepository.save(submission);

      return res.json({ status: 'success', message: 'Submission marked successfully', data: { submission } });
    } catch (error: any) {
      return res.status(400).json({ status: 'error', message: error.message || 'Failed to mark submission' });
    }
  }

  // Download submission
  async downloadSubmission(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const submission = await this.submissionRepository.findOne({
        where: { id },
        relations: ['assignment', 'assignment.lecturer', 'assignment.lecturer.user', 'student', 'student.user']
      });

      if (!submission) {
        return res.status(404).json({ status: 'error', message: 'Submission not found' });
      }

      // Only lecturer or student themselves can download
      const user = (req as any).user;
      if (submission.assignment.lecturer.user.id !== user.userId && 
          submission.student.user.id !== user.userId && 
          user.role !== Role.ADMIN) {
        return res.status(403).json({ status: 'error', message: 'Unauthorized' });
      }

      const filePath = path.join(__dirname, '../../', submission.fileUrl);
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ status: 'error', message: 'File not found' });
      }

      return res.download(filePath);
    } catch (error: any) {
      return res.status(500).json({ status: 'error', message: error.message || 'Failed to download file' });
    }
  }
}

export default new AssignmentController();