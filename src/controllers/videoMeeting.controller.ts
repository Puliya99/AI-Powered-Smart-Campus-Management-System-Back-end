import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { AppDataSource } from '../config/database';
import { VideoMeeting } from '../entities/VideoMeeting.entity';
import { MeetingParticipant } from '../entities/MeetingParticipant.entity';
import { Module } from '../entities/Module.entity';
import { Lecturer } from '../entities/Lecturer.entity';
import { Batch } from '../entities/Batch.entity';
import { Student } from '../entities/Student.entity';
import { Enrollment } from '../entities/Enrollment.entity';
import { Role } from '../enums/Role.enum';
import { io } from '../config/socket';

export class VideoMeetingController {

  private meetingRepository = AppDataSource.getRepository(VideoMeeting);
  private participantRepository = AppDataSource.getRepository(MeetingParticipant);
  private moduleRepository = AppDataSource.getRepository(Module);
  private lecturerRepository = AppDataSource.getRepository(Lecturer);
  private batchRepository = AppDataSource.getRepository(Batch);
  private studentRepository = AppDataSource.getRepository(Student);
  private enrollmentRepository = AppDataSource.getRepository(Enrollment);

  // Create a new meeting (Lecturer only)
  async createMeeting(req: Request, res: Response) {
    try {
      const { title, moduleId, batchId } = req.body;
      const userId = (req as any).user.userId;

      const lecturer = await this.lecturerRepository.findOne({
        where: { user: { id: userId } },
      });

      if (!lecturer) {
        return res.status(403).json({
          status: 'error',
          message: 'Only lecturers can create meetings',
        });
      }

      const module = await this.moduleRepository.findOne({
        where: { id: moduleId },
      });

      if (!module) {
        return res.status(404).json({
          status: 'error',
          message: 'Module not found',
        });
      }

      if (!batchId) {
        return res.status(400).json({
          status: 'error',
          message: 'Batch is required',
        });
      }

      const batch = await this.batchRepository.findOne({ where: { id: batchId } });
      if (!batch) {
        return res.status(404).json({
          status: 'error',
          message: 'Batch not found',
        });
      }

      const meetingCode = uuidv4().substring(0, 8).toUpperCase();

      const meeting = this.meetingRepository.create({
        title,
        module,
        lecturer,
        batch,
        meetingCode,
        startTime: new Date(),
        isActive: true,
      });

      await this.meetingRepository.save(meeting);

      // Re-fetch with batch relation for full response
      const saved = await this.meetingRepository.findOne({
        where: { id: meeting.id },
        relations: ['module', 'lecturer', 'lecturer.user', 'batch'],
      });

      res.status(201).json({
        status: 'success',
        data: { meeting: saved },
      });
    } catch (error: any) {
      res.status(500).json({
        status: 'error',
        message: error.message || 'Failed to create meeting',
      });
    }
  }

  // Get active meeting by code
  async getMeetingByCode(req: Request, res: Response) {
    try {
      const { code } = req.params;

      const meeting = await this.meetingRepository.findOne({
        where: { meetingCode: code },
        relations: ['lecturer', 'lecturer.user', 'module'],
      });

      if (!meeting) {
        return res.status(404).json({
          status: 'error',
          message: 'Meeting not found',
        });
      }

      res.json({
        status: 'success',
        data: { meeting },
      });
    } catch (error: any) {
      res.status(500).json({
        status: 'error',
        message: error.message || 'Failed to fetch meeting',
      });
    }
  }

  // End meeting
  async endMeeting(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const userId = (req as any).user.userId;

      const meeting = await this.meetingRepository.findOne({
        where: { id },
        relations: ['lecturer', 'lecturer.user'],
      });

      if (!meeting) {
        return res.status(404).json({
          status: 'error',
          message: 'Meeting not found',
        });
      }

      if (meeting.lecturer.user.id !== userId && (req as any).user.role !== Role.ADMIN) {
        return res.status(403).json({
          status: 'error',
          message: 'Unauthorized to end this meeting',
        });
      }

      meeting.isActive = false;
      meeting.endTime = new Date();
      await this.meetingRepository.save(meeting);

      // Notify all participants in the meeting room via socket
      if (io) {
        io.to(meeting.meetingCode).emit('meeting-ended', {
          meetingId: meeting.id,
          message: 'The host has ended the meeting'
        });
      }

      res.json({
        status: 'success',
        message: 'Meeting ended successfully',
      });
    } catch (error: any) {
      res.status(500).json({
        status: 'error',
        message: error.message || 'Failed to end meeting',
      });
    }
  }

  // Get active meetings for a module
  async getActiveMeetingsByModule(req: Request, res: Response) {
    try {
      const { moduleId } = req.params;

      const meetings = await this.meetingRepository.find({
        where: { module: { id: moduleId }, isActive: true },
        relations: ['lecturer', 'lecturer.user'],
        order: { startTime: 'DESC' },
      });

      res.json({
        status: 'success',
        data: { meetings },
      });
    } catch (error: any) {
      res.status(500).json({
        status: 'error',
        message: error.message || 'Failed to fetch active meetings',
      });
    }
  }

  // Get my active meetings (Lecturer only)
  async getMyActiveMeetings(req: Request, res: Response) {
    try {
      const userId = (req as any).user.userId;

      const meetings = await this.meetingRepository.find({
        where: { lecturer: { user: { id: userId } }, isActive: true },
        relations: ['module', 'lecturer', 'lecturer.user', 'batch'],
        order: { startTime: 'DESC' },
      });

      res.json({
        status: 'success',
        data: { meetings },
      });
    } catch (error: any) {
      res.status(500).json({
        status: 'error',
        message: error.message || 'Failed to fetch your active meetings',
      });
    }
  }

  // Get meeting history
  async getMeetingHistory(req: Request, res: Response) {
    try {
      const userId = (req as any).user.userId;
      const role = (req as any).user.role;

      let meetings;
      if (role === Role.LECTURER || role === Role.ADMIN) {
        // If lecturer or admin, get meetings they hosted (or all if admin, but here we assume lecturer context)
        const lecturer = await this.lecturerRepository.findOne({
          where: { user: { id: userId } },
        });

        if (lecturer) {
          meetings = await this.meetingRepository.find({
            where: { lecturer: { id: lecturer.id } },
            relations: ['module'],
            order: { startTime: 'DESC' },
          });
        }
      }

      if (!meetings) {
        // If student or lecturer not found, get meetings they participated in
        const participations = await this.participantRepository.find({
          where: { user: { id: userId } },
          relations: ['meeting', 'meeting.module', 'meeting.lecturer', 'meeting.lecturer.user'],
          order: { joinedAt: 'DESC' },
        });
        meetings = participations.map(p => p.meeting);
      }

      res.json({
        status: 'success',
        data: { meetings },
      });
    } catch (error: any) {
      res.status(500).json({
        status: 'error',
        message: error.message || 'Failed to fetch meeting history',
      });
    }
  }

  // Get meeting by ID
  async getMeetingById(req: Request, res: Response) {
    try {
      const { id } = req.params;

      const meeting = await this.meetingRepository.findOne({
        where: { id },
        relations: ['lecturer', 'lecturer.user', 'module'],
      });

      if (!meeting) {
        return res.status(404).json({
          status: 'error',
          message: 'Meeting not found',
        });
      }

      res.json({
        status: 'success',
        data: { meeting },
      });
    } catch (error: any) {
      res.status(500).json({
        status: 'error',
        message: error.message || 'Failed to fetch meeting',
      });
    }
  }

  // Join meeting
  async joinMeeting(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const userId = (req as any).user.userId;
      const role = (req as any).user.role;

      const meeting = await this.meetingRepository.findOne({
        where: { id },
        relations: ['lecturer', 'lecturer.user', 'batch'],
      });

      if (!meeting) {
        return res.status(404).json({
          status: 'error',
          message: 'Meeting not found',
        });
      }

      if (!meeting.isActive) {
        return res.status(400).json({
          status: 'error',
          message: 'Meeting has already ended',
        });
      }

      // If the meeting is for a specific batch, verify the student is enrolled in it
      if (meeting.batch && role === Role.STUDENT) {
        const student = await this.studentRepository.findOne({
          where: { user: { id: userId } },
        });

        if (student) {
          const enrollment = await this.enrollmentRepository.findOne({
            where: {
              student: { id: student.id },
              batch: { id: meeting.batch.id },
            },
          });

          if (!enrollment) {
            return res.status(403).json({
              status: 'error',
              message: 'You are not enrolled in the batch for this lecture',
            });
          }
        }
      }

      // Check if already in meeting
      let participant = await this.participantRepository.findOne({
        where: { meeting: { id }, user: { id: userId }, leftAt: undefined },
      });

      if (!participant) {
        participant = this.participantRepository.create({
          meeting,
          user: { id: userId } as any,
          role: meeting.lecturer.user.id === userId ? 'HOST' : 'PARTICIPANT',
          joinedAt: new Date(),
        });
        await this.participantRepository.save(participant);
      }

      res.json({
        status: 'success',
        data: { participant },
      });
    } catch (error: any) {
      res.status(500).json({
        status: 'error',
        message: error.message || 'Failed to join meeting',
      });
    }
  }

  // Get active meetings for the logged-in student (filtered by their enrolled batches)
  async getStudentActiveMeetings(req: Request, res: Response) {
    try {
      const userId = (req as any).user.userId;

      const student = await this.studentRepository.findOne({
        where: { user: { id: userId } },
      });

      if (!student) {
        return res.status(404).json({
          status: 'error',
          message: 'Student record not found',
        });
      }

      // Get the student's active enrolled batch IDs
      const enrollments = await this.enrollmentRepository.find({
        where: { student: { id: student.id }, status: 'ACTIVE' as any },
        relations: ['batch'],
      });

      const batchIds = enrollments.map(e => e.batch?.id).filter(Boolean);

      if (batchIds.length === 0) {
        return res.json({ status: 'success', data: { meetings: [] } });
      }

      const meetings = await this.meetingRepository
        .createQueryBuilder('meeting')
        .leftJoinAndSelect('meeting.module', 'module')
        .leftJoinAndSelect('meeting.lecturer', 'lecturer')
        .leftJoinAndSelect('lecturer.user', 'lecturerUser')
        .leftJoinAndSelect('meeting.batch', 'batch')
        .where('meeting.isActive = :isActive', { isActive: true })
        .andWhere('batch.id IN (:...batchIds)', { batchIds })
        .orderBy('meeting.startTime', 'DESC')
        .getMany();

      res.json({
        status: 'success',
        data: { meetings },
      });
    } catch (error: any) {
      res.status(500).json({
        status: 'error',
        message: error.message || 'Failed to fetch active meetings',
      });
    }
  }

  // Leave meeting
  async leaveMeeting(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const userId = (req as any).user.userId;

      const participant = await this.participantRepository.findOne({
        where: { meeting: { id }, user: { id: userId }, leftAt: undefined },
        order: { joinedAt: 'DESC' }
      });

      if (participant) {
        participant.leftAt = new Date();
        await this.participantRepository.save(participant);
      }

      res.json({
        status: 'success',
        message: 'Left meeting successfully',
      });
    } catch (error: any) {
      res.status(500).json({
        status: 'error',
        message: error.message || 'Failed to leave meeting',
      });
    }
  }

  // Get meeting participants
  async getMeetingParticipants(req: Request, res: Response) {
    try {
      const { id } = req.params;

      const participants = await this.participantRepository.find({
        where: { meeting: { id } },
        relations: ['user'],
        order: { joinedAt: 'ASC' },
      });

      res.json({
        status: 'success',
        data: { participants },
      });
    } catch (error: any) {
      res.status(500).json({
        status: 'error',
        message: error.message || 'Failed to fetch participants',
      });
    }
  }
}

export default new VideoMeetingController();
