import { Request, Response } from 'express';
import { AppDataSource } from '../config/database';
import { Result } from '../entities/Result.entity';
import { Module } from '../entities/Module.entity';
import { Student } from '../entities/Student.entity';
import { Lecturer } from '../entities/Lecturer.entity';
import { Enrollment } from '../entities/Enrollment.entity';
import { Program } from '../entities/Program.entity';
import { Batch } from '../entities/Batch.entity';
import { Center } from '../entities/Center.entity';
import { User } from '../entities/User.entity';
import { Attendance } from '../entities/Attendance.entity';
import { QuizAttempt } from '../entities/QuizAttempt.entity';
import { QuizViolation } from '../entities/QuizViolation.entity';
import { Assignment } from '../entities/Assignment.entity';
import { Submission } from '../entities/Submission.entity';
import { Borrowing } from '../entities/Borrowing.entity';
import { LectureNote } from '../entities/LectureNote.entity';
import { RepeatExamEnrollment, RepeatExamStatus } from '../entities/RepeatExamEnrollment.entity';
import { Role } from '../enums/Role.enum';
import { ResultStatus } from '../enums/ResultStatus.enum';
import { EnrollmentStatus } from '../enums/EnrollmentStatus.enum';
import { AttendanceStatus } from '../enums/AttendanceStatus.enum';
import notificationService from '../services/notification.service';
import { NotificationType } from '../enums/NotificationType.enum';

// ── GPA helpers ──────────────────────────────────────────────────────────────

/**
 * Convert a raw percentage (0-100) to a GPA point on a 4.0 scale.
 * Pass threshold: 40 %.
 */
function percentageToGpaPoints(pct: number): number {
  if (pct >= 90) return 4.0;
  if (pct >= 80) return 4.0;
  if (pct >= 75) return 3.7;
  if (pct >= 70) return 3.3;
  if (pct >= 65) return 3.0;
  if (pct >= 60) return 2.7;
  if (pct >= 55) return 2.3;
  if (pct >= 50) return 2.0;
  if (pct >= 40) return 1.0;
  return 0.0;
}

function percentageToGrade(pct: number): string {
  if (pct >= 90) return 'A+';
  if (pct >= 80) return 'A';
  if (pct >= 75) return 'A-';
  if (pct >= 70) return 'B+';
  if (pct >= 65) return 'B';
  if (pct >= 60) return 'B-';
  if (pct >= 55) return 'C+';
  if (pct >= 50) return 'C';
  if (pct >= 40) return 'D';
  return 'F';
}

function gpaToClass(gpa: number): string {
  if (gpa >= 3.70) return 'First Class';
  if (gpa >= 3.30) return 'Second Class Upper';
  if (gpa >= 3.00) return 'Second Class Lower';
  if (gpa >= 2.00) return 'Pass';
  return 'Fail';
}

// ── Risk factor weights ───────────────────────────────────────────────────────
//  attendance (25%) · quiz (20%) · assignment (20%) · violations (20%)
//  · material engagement (10%) · library use (5%)
const RISK_WEIGHTS = {
  attendance:  0.25,
  quiz:        0.20,
  assignment:  0.20,
  violations:  0.20,
  materials:   0.10,
  library:     0.05,
};

/**
 * Compute risk factors for a student across the given set of program module IDs.
 * Each factor returns a "safety score" 0-100: 100 = perfectly safe, 0 = maximum risk.
 * The overall weighted score determines the RiskLevel:
 *   LOW    ≥ 75
 *   MEDIUM 50 – 74
 *   HIGH   < 50
 */
async function computeRiskFactors(
  studentId: string,
  userId:    string,
  moduleIds: string[],
): Promise<{
  factors: {
    attendance:  { score: number; detail: string };
    quiz:        { score: number; detail: string };
    assignment:  { score: number; detail: string };
    violations:  { score: number; detail: string };
    materials:   { score: number; detail: string };
    library:     { score: number; detail: string };
  };
  overallScore: number;
  riskLevel:    'LOW' | 'MEDIUM' | 'HIGH';
}> {
  if (moduleIds.length === 0) {
    return {
      factors: {
        attendance:  { score: 50, detail: 'No modules' },
        quiz:        { score: 50, detail: 'No modules' },
        assignment:  { score: 50, detail: 'No modules' },
        violations:  { score: 100, detail: 'No violations' },
        materials:   { score: 50, detail: 'No modules' },
        library:     { score: 50, detail: 'No data' },
      },
      overallScore: 50,
      riskLevel:    'MEDIUM',
    };
  }

  // ── 1. Attendance ────────────────────────────────────────────────────────────
  const totalAtt = await AppDataSource.getRepository(Attendance)
    .createQueryBuilder('a')
    .innerJoin('a.schedule', 'sch')
    .innerJoin('sch.module', 'mod')
    .where('a.student = :sid', { sid: studentId })
    .andWhere('mod.id IN (:...mids)', { mids: moduleIds })
    .getCount();

  const presentAtt = await AppDataSource.getRepository(Attendance)
    .createQueryBuilder('a')
    .innerJoin('a.schedule', 'sch')
    .innerJoin('sch.module', 'mod')
    .where('a.student = :sid', { sid: studentId })
    .andWhere('mod.id IN (:...mids)', { mids: moduleIds })
    .andWhere('a.status = :st', { st: AttendanceStatus.PRESENT })
    .getCount();

  const attendanceRate  = totalAtt > 0 ? (presentAtt / totalAtt) * 100 : 50;
  const attendanceScore = Math.round(attendanceRate);
  const attendanceDetail = totalAtt > 0
    ? `${presentAtt}/${totalAtt} sessions attended (${attendanceScore}%)`
    : 'No attendance records';

  // ── 2. Quiz performance ───────────────────────────────────────────────────────
  const quizAttempts = await AppDataSource.getRepository(QuizAttempt)
    .createQueryBuilder('qa')
    .innerJoinAndSelect('qa.quiz', 'quiz')
    .innerJoin('quiz.module', 'mod')
    .where('qa.student = :sid', { sid: studentId })
    .andWhere('mod.id IN (:...mids)', { mids: moduleIds })
    .andWhere('qa.status = :st', { st: 'SUBMITTED' })
    .getMany();

  let quizScore = 50;
  let quizDetail = 'No quiz attempts';
  if (quizAttempts.length > 0) {
    const avgPct = quizAttempts.reduce((sum, qa) => {
      const total = parseFloat(qa.quiz.totalMarks as any) || 1;
      return sum + (parseFloat(qa.score as any) / total) * 100;
    }, 0) / quizAttempts.length;
    quizScore  = Math.round(Math.max(0, Math.min(100, avgPct)));
    quizDetail = `Avg ${quizScore}% across ${quizAttempts.length} quiz attempt(s)`;
  }

  // ── 3. Assignment submission & scoring ────────────────────────────────────────
  const totalAssignments = await AppDataSource.getRepository(Assignment)
    .createQueryBuilder('asgn')
    .innerJoin('asgn.module', 'mod')
    .where('mod.id IN (:...mids)', { mids: moduleIds })
    .getCount();

  const submittedCount = await AppDataSource.getRepository(Submission)
    .createQueryBuilder('sub')
    .innerJoin('sub.assignment', 'asgn')
    .innerJoin('asgn.module', 'mod')
    .where('sub.student = :sid', { sid: studentId })
    .andWhere('mod.id IN (:...mids)', { mids: moduleIds })
    .getCount();

  const lateCount = await AppDataSource.getRepository(Submission)
    .createQueryBuilder('sub')
    .innerJoin('sub.assignment', 'asgn')
    .innerJoin('asgn.module', 'mod')
    .where('sub.student = :sid', { sid: studentId })
    .andWhere('mod.id IN (:...mids)', { mids: moduleIds })
    .andWhere('sub.isLate = true')
    .getCount();

  let assignmentScore = 50;
  let assignmentDetail = 'No assignments';
  if (totalAssignments > 0) {
    const subRate   = (submittedCount / totalAssignments) * 100;
    const latePenalty = Math.min(30, lateCount * 5);
    assignmentScore   = Math.round(Math.max(0, Math.min(100, subRate - latePenalty)));
    assignmentDetail  = `${submittedCount}/${totalAssignments} submitted${lateCount > 0 ? `, ${lateCount} late (-${latePenalty}pts)` : ''}`;
  }

  // ── 4. Exam violations ────────────────────────────────────────────────────────
  const violationCount = await AppDataSource.getRepository(QuizViolation)
    .createQueryBuilder('v')
    .innerJoin('v.attempt', 'qa')
    .innerJoin('qa.quiz', 'quiz')
    .innerJoin('quiz.module', 'mod')
    .innerJoin('qa.student', 'stu')
    .where('stu.id = :sid', { sid: studentId })
    .andWhere('mod.id IN (:...mids)', { mids: moduleIds })
    .getCount();

  const violationScore  = Math.round(Math.max(0, 100 - violationCount * 15));
  const violationDetail = violationCount === 0
    ? 'No violations recorded'
    : `${violationCount} violation(s) detected`;

  // ── 5. Material engagement ────────────────────────────────────────────────────
  // Proxy: modules where the student has at least 1 quiz attempt OR 1 submission
  //        vs total modules that have any material/quiz/assignment content
  const modulesWithAttempt = new Set<string>();
  quizAttempts.forEach(qa => modulesWithAttempt.add((qa.quiz as any).moduleId || ''));

  const engagedSubs = await AppDataSource.getRepository(Submission)
    .createQueryBuilder('sub')
    .select('mod.id', 'modId')
    .innerJoin('sub.assignment', 'asgn')
    .innerJoin('asgn.module', 'mod')
    .where('sub.student = :sid', { sid: studentId })
    .andWhere('mod.id IN (:...mids)', { mids: moduleIds })
    .distinct(true)
    .getRawMany();
  engagedSubs.forEach(r => modulesWithAttempt.add(r.modId));

  const totalMaterials = await AppDataSource.getRepository(LectureNote)
    .createQueryBuilder('ln')
    .select('ln.moduleId', 'modId')
    .where('ln.module IN (:...mids)', { mids: moduleIds })
    .distinct(true)
    .getRawMany();
  const modulesWithContent = totalMaterials.length + (totalAssignments > 0 ? 1 : 0);
  const engagedModules = modulesWithAttempt.size;

  let materialsScore  = 50;
  let materialsDetail = 'No engagement data';
  if (modulesWithContent > 0 || moduleIds.length > 0) {
    const baseline = Math.min(moduleIds.length, Math.max(modulesWithContent, 1));
    materialsScore  = Math.round(Math.min(100, (engagedModules / baseline) * 100));
    materialsDetail = `Engaged with ${engagedModules} of ${baseline} module(s)`;
  }

  // ── 6. Library usage ─────────────────────────────────────────────────────────
  const borrowingCount = await AppDataSource.getRepository(Borrowing)
    .createQueryBuilder('b')
    .where('b.borrower = :uid', { uid: userId })
    .getCount();

  // More borrowings = lower risk (capped at 5 = 100% safe)
  const libraryScore  = Math.min(100, borrowingCount * 20);
  const libraryDetail = `${borrowingCount} book(s) borrowed`;

  // ── Weighted overall score ────────────────────────────────────────────────────
  const overallScore = Math.round(
    attendanceScore * RISK_WEIGHTS.attendance +
    quizScore       * RISK_WEIGHTS.quiz +
    assignmentScore * RISK_WEIGHTS.assignment +
    violationScore  * RISK_WEIGHTS.violations +
    materialsScore  * RISK_WEIGHTS.materials +
    libraryScore    * RISK_WEIGHTS.library,
  );

  const riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' =
    overallScore >= 75 ? 'LOW' :
    overallScore >= 50 ? 'MEDIUM' : 'HIGH';

  return {
    factors: {
      attendance:  { score: attendanceScore,  detail: attendanceDetail  },
      quiz:        { score: quizScore,        detail: quizDetail        },
      assignment:  { score: assignmentScore,  detail: assignmentDetail  },
      violations:  { score: violationScore,   detail: violationDetail   },
      materials:   { score: materialsScore,   detail: materialsDetail   },
      library:     { score: libraryScore,     detail: libraryDetail     },
    },
    overallScore,
    riskLevel,
  };
}

// ─────────────────────────────────────────────────────────────────────────────

export class ResultController {
  private resultRepository         = AppDataSource.getRepository(Result);
  private moduleRepository         = AppDataSource.getRepository(Module);
  private studentRepository        = AppDataSource.getRepository(Student);
  private lecturerRepository       = AppDataSource.getRepository(Lecturer);
  private enrollmentRepository     = AppDataSource.getRepository(Enrollment);
  private programRepository        = AppDataSource.getRepository(Program);
  private batchRepository          = AppDataSource.getRepository(Batch);
  private centerRepository         = AppDataSource.getRepository(Center);
  private repeatEnrollRepository   = AppDataSource.getRepository(RepeatExamEnrollment);

  // ── Get results for a module (Lecturer / Admin / USER) ───────────────────

  async getResultsByModule(req: Request, res: Response) {
    try {
      const { moduleId } = req.params;
      const user = (req as any).user;

      const module = await this.moduleRepository.findOne({
        where: { id: moduleId },
        relations: ['lecturer', 'program'],
      });

      if (!module) {
        return res.status(404).json({ status: 'error', message: 'Module not found' });
      }

      if (user.role === Role.LECTURER) {
        const lecturer = await this.lecturerRepository.findOne({
          where: { user: { id: user.userId } },
        });
        if (!lecturer || module.lecturer.id !== lecturer.id) {
          return res.status(403).json({ status: 'error', message: 'Not authorized for this module' });
        }
      } else if (user.role !== Role.ADMIN && user.role !== Role.USER) {
        return res.status(403).json({ status: 'error', message: 'Insufficient permissions' });
      }

      const results = await this.resultRepository.find({
        where: { module: { id: moduleId } },
        relations: ['student', 'student.user', 'batch'],
        order: { student: { user: { firstName: 'ASC' } } },
      });

      const enrollments = await this.enrollmentRepository.find({
        where: { program: { id: module.program.id }, status: EnrollmentStatus.ACTIVE },
        relations: ['student', 'student.user'],
      });

      res.json({
        status: 'success',
        data: { results, enrolledStudents: enrollments.map(e => e.student) },
      });
    } catch (error: any) {
      res.status(500).json({ status: 'error', message: error.message || 'Failed to fetch results' });
    }
  }

  // ── Upsert a single result ────────────────────────────────────────────────

  async upsertResult(req: Request, res: Response) {
    try {
      const { studentId, moduleId, batchId, marks, maxMarks, grade, status, examDate, remarks, isRepeat } = req.body;
      const user = (req as any).user;

      const module = await this.moduleRepository.findOne({
        where: { id: moduleId },
        relations: ['lecturer'],
      });
      if (!module) return res.status(404).json({ status: 'error', message: 'Module not found' });

      if (user.role === Role.LECTURER) {
        const lecturer = await this.lecturerRepository.findOne({ where: { user: { id: user.userId } } });
        if (!lecturer || module.lecturer.id !== lecturer.id) {
          return res.status(403).json({ status: 'error', message: 'Unauthorized' });
        }
      } else if (user.role !== Role.ADMIN && user.role !== Role.USER) {
        return res.status(403).json({ status: 'error', message: 'Insufficient permissions' });
      }

      const student = await this.studentRepository.findOne({ where: { id: studentId } });
      if (!student) return res.status(404).json({ status: 'error', message: 'Student not found' });

      // For repeats we always create a new record; for first sits we upsert
      let result: Result | null = null;
      if (!isRepeat) {
        result = await this.resultRepository.findOne({
          where: { student: { id: studentId }, module: { id: moduleId }, isRepeat: false },
        }) ?? null;
      }

      const batch = batchId
        ? await this.batchRepository.findOne({ where: { id: batchId } })
        : null;

      // Auto-compute grade from percentage if not supplied
      const pct = Math.round((marks / maxMarks) * 100);
      const computedGrade = grade || percentageToGrade(pct);
      const computedStatus = status || (pct >= 40 ? ResultStatus.PASS : ResultStatus.FAIL);

      if (result) {
        result.marks       = marks;
        result.maxMarks    = maxMarks;
        result.grade       = computedGrade;
        result.status      = computedStatus;
        result.examDate    = examDate ? new Date(examDate) : result.examDate;
        result.remarks     = remarks;
        result.batch       = batch;
      } else {
        // Determine attempt number
        const prevCount = await this.resultRepository.count({
          where: { student: { id: studentId }, module: { id: moduleId } },
        });
        result = this.resultRepository.create({
          student,
          module,
          batch,
          marks,
          maxMarks,
          grade:         computedGrade,
          status:        computedStatus,
          examDate:      examDate ? new Date(examDate) : new Date(),
          remarks,
          attemptNumber: prevCount + 1,
          isRepeat:      !!isRepeat,
        });
      }

      await this.resultRepository.save(result);

      // If a student passed a repeat, mark the repeat enrollment as completed
      if (result.isRepeat && result.status === ResultStatus.PASS) {
        await this.repeatEnrollRepository.update(
          { student: { id: studentId }, module: { id: moduleId }, status: RepeatExamStatus.NOTIFIED },
          { status: RepeatExamStatus.COMPLETED },
        );
      }

      // Notify the student
      try {
        const sw = await this.studentRepository.findOne({ where: { id: studentId }, relations: ['user'] });
        if (sw) {
          await notificationService.createNotification({
            userId: sw.user.id,
            title: `Result ${result.isRepeat ? '(Repeat) ' : ''}Updated: ${module.moduleName}`,
            message: `Your ${result.isRepeat ? 'repeat ' : ''}result for ${module.moduleName} has been published. Grade: ${computedGrade} | Status: ${computedStatus}.`,
            type:  NotificationType.RESULT,
            link:  '/student/results',
            sendEmail: true,
          });
        }
      } catch { /* non-blocking */ }

      res.json({ status: 'success', message: 'Result saved successfully', data: { result } });
    } catch (error: any) {
      res.status(500).json({ status: 'error', message: error.message || 'Failed to save result' });
    }
  }

  // ── Bulk upsert results ───────────────────────────────────────────────────

  async bulkUpsertResults(req: Request, res: Response) {
    try {
      const { moduleId, batchId, results, isRepeat } = req.body;
      const user = (req as any).user;

      const module = await this.moduleRepository.findOne({
        where: { id: moduleId },
        relations: ['lecturer'],
      });
      if (!module) return res.status(404).json({ status: 'error', message: 'Module not found' });

      if (user.role === Role.LECTURER) {
        const lecturer = await this.lecturerRepository.findOne({ where: { user: { id: user.userId } } });
        if (!lecturer || module.lecturer.id !== lecturer.id) {
          return res.status(403).json({ status: 'error', message: 'Unauthorized' });
        }
      } else if (user.role !== Role.ADMIN && user.role !== Role.USER) {
        return res.status(403).json({ status: 'error', message: 'Insufficient permissions' });
      }

      const batch = batchId ? await this.batchRepository.findOne({ where: { id: batchId } }) : null;

      for (const resData of results) {
        const { studentId, marks, maxMarks, grade, status, examDate, remarks } = resData;
        const student = await this.studentRepository.findOne({ where: { id: studentId } });
        if (!student) continue;

        const pct = Math.round((marks / maxMarks) * 100);
        const computedGrade  = grade  || percentageToGrade(pct);
        const computedStatus = status || (pct >= 40 ? ResultStatus.PASS : ResultStatus.FAIL);

        let result: Result | null = null;
        if (!isRepeat) {
          result = await this.resultRepository.findOne({
            where: { student: { id: studentId }, module: { id: moduleId }, isRepeat: false },
          }) ?? null;
        }

        if (result) {
          result.marks    = marks;
          result.maxMarks = maxMarks;
          result.grade    = computedGrade;
          result.status   = computedStatus;
          result.examDate = examDate ? new Date(examDate) : result.examDate;
          result.remarks  = remarks;
          result.batch    = batch;
        } else {
          const prevCount = await this.resultRepository.count({
            where: { student: { id: studentId }, module: { id: moduleId } },
          });
          result = this.resultRepository.create({
            student, module, batch,
            marks, maxMarks,
            grade: computedGrade, status: computedStatus,
            examDate: examDate ? new Date(examDate) : new Date(),
            remarks,
            attemptNumber: prevCount + 1,
            isRepeat: !!isRepeat,
          });
        }

        await this.resultRepository.save(result);

        if (result.isRepeat && result.status === ResultStatus.PASS) {
          await this.repeatEnrollRepository.update(
            { student: { id: studentId }, module: { id: moduleId }, status: RepeatExamStatus.NOTIFIED },
            { status: RepeatExamStatus.COMPLETED },
          );
        }

        try {
          const sw = await this.studentRepository.findOne({ where: { id: studentId }, relations: ['user'] });
          if (sw) {
            await notificationService.createNotification({
              userId: sw.user.id,
              title: `Result Published: ${module.moduleName}`,
              message: `Your ${isRepeat ? 'repeat ' : ''}result for ${module.moduleName} has been published. Grade: ${computedGrade}.`,
              type: NotificationType.RESULT,
              link: '/student/results',
              sendEmail: true,
            });
          }
        } catch { /* non-blocking */ }
      }

      res.json({ status: 'success', message: 'Results updated successfully' });
    } catch (error: any) {
      res.status(500).json({ status: 'error', message: error.message || 'Failed to update results' });
    }
  }

  // ── Delete result ─────────────────────────────────────────────────────────

  async deleteResult(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const user = (req as any).user;

      const result = await this.resultRepository.findOne({
        where: { id },
        relations: ['module', 'module.lecturer'],
      });
      if (!result) return res.status(404).json({ status: 'error', message: 'Result not found' });

      if (user.role === Role.LECTURER) {
        const lecturer = await this.lecturerRepository.findOne({ where: { user: { id: user.userId } } });
        if (!lecturer || result.module.lecturer.id !== lecturer.id) {
          return res.status(403).json({ status: 'error', message: 'Unauthorized' });
        }
      } else if (user.role !== Role.ADMIN && user.role !== Role.USER) {
        return res.status(403).json({ status: 'error', message: 'Insufficient permissions' });
      }

      await this.resultRepository.remove(result);
      res.json({ status: 'success', message: 'Result deleted successfully' });
    } catch (error: any) {
      res.status(500).json({ status: 'error', message: error.message || 'Failed to delete result' });
    }
  }

  // ── Get student's own results ─────────────────────────────────────────────

  async getMyResults(req: Request, res: Response) {
    try {
      const userId = (req as any).user.userId;

      const student = await this.studentRepository.findOne({ where: { user: { id: userId } } });
      if (!student) return res.status(404).json({ status: 'error', message: 'Student profile not found' });

      const results = await this.resultRepository.find({
        where: { student: { id: student.id } },
        relations: ['module', 'module.program', 'batch'],
        order: { module: { moduleName: 'ASC' }, attemptNumber: 'ASC' },
      });

      // Best result per module (highest marks or PASS status)
      const bestByModule = new Map<string, Result>();
      for (const r of results) {
        const key = r.module.id;
        const existing = bestByModule.get(key);
        if (!existing || r.marks > existing.marks) bestByModule.set(key, r);
      }

      res.json({
        status: 'success',
        data: { results, bestResults: Array.from(bestByModule.values()) },
      });
    } catch (error: any) {
      res.status(500).json({ status: 'error', message: error.message || 'Failed to fetch your results' });
    }
  }

  // ── Graduation Report ─────────────────────────────────────────────────────
  /**
   * GET /results/graduation-report?programId=&batchId=&centerId=
   * Admin: sees all centers (centerId filter optional)
   * USER:  sees only their own center (centerId is forced from their profile)
   */
  async getGraduationReport(req: Request, res: Response) {
    try {
      const { programId, batchId } = req.query as Record<string, string>;
      const user = (req as any).user;

      if (!programId) {
        return res.status(400).json({ status: 'error', message: 'programId is required' });
      }

      // Center scoping
      let centerId = req.query.centerId as string | undefined;
      if (user.role === Role.USER) {
        // Staff can only see their own center
        const staffUser = await AppDataSource.getRepository(User)
          .findOne({ where: { id: user.userId }, relations: ['center'] });
        centerId = staffUser?.center?.id ?? undefined;
      }

      // Fetch program with all its modules
      const program = await this.programRepository.findOne({
        where: { id: programId },
        relations: ['modules', 'modules.lecturer'],
      });
      if (!program) return res.status(404).json({ status: 'error', message: 'Program not found' });

      const programModules = program.modules;
      if (programModules.length === 0) {
        return res.json({
          status: 'success',
          data: { program, batch: null, center: null, totalModules: 0, students: [] },
        });
      }

      // Resolve batch
      let batch: Batch | null = null;
      if (batchId) {
        batch = await this.batchRepository.findOne({
          where: { id: batchId },
          relations: ['centers'],
        });
        if (!batch) return res.status(404).json({ status: 'error', message: 'Batch not found' });
      }

      // Resolve center filter
      let center: Center | null = null;
      if (centerId) {
        center = await this.centerRepository.findOne({ where: { id: centerId } });
      }

      // Build enrollment query – filter by program, optionally by batch/center
      let enrollQb = this.enrollmentRepository
        .createQueryBuilder('e')
        .leftJoinAndSelect('e.student', 'student')
        .leftJoinAndSelect('student.user', 'u')
        .leftJoinAndSelect('student.payments', 'payments')
        .where('e.program = :programId', { programId });

      if (batchId) enrollQb = enrollQb.andWhere('e.batch = :batchId', { batchId });

      if (centerId) {
        enrollQb = enrollQb
          .leftJoin('e.batch', 'eb')
          .leftJoin('eb.centers', 'bc')
          .andWhere('bc.id = :centerId', { centerId });
      }

      const enrollments = await enrollQb.getMany();

      // For each enrolled student build their module results profile
      const studentRows = await Promise.all(
        enrollments.map(async (enr) => {
          const student = enr.student;
          const moduleIds = programModules.map(m => m.id);

          // All results for this student for this program's modules
          const allResults = await this.resultRepository
            .createQueryBuilder('r')
            .leftJoinAndSelect('r.module', 'module')
            .leftJoinAndSelect('r.batch', 'batch')
            .where('r.student = :sid', { sid: student.id })
            .andWhere('module.id IN (:...mids)', { mids: moduleIds })
            .orderBy('r.attemptNumber', 'ASC')
            .getMany();

          // Best result per module (highest marks, favouring PASS)
          const bestByModule = new Map<string, Result>();
          for (const r of allResults) {
            const key = r.module.id;
            const ex = bestByModule.get(key);
            if (!ex) { bestByModule.set(key, r); continue; }
            // Prefer PASS over FAIL; if same status, prefer higher marks
            if (ex.status !== ResultStatus.PASS && r.status === ResultStatus.PASS) {
              bestByModule.set(key, r);
            } else if (ex.status === r.status && r.marks > ex.marks) {
              bestByModule.set(key, r);
            }
          }

          // Repeat exam enrollments for this student
          const repeatEnrollments = await this.repeatEnrollRepository.find({
            where: { student: { id: student.id }, module: { id: undefined } },
            relations: ['module', 'originalBatch', 'nextBatch'],
          });
          // Re-fetch properly
          const repeats = await this.repeatEnrollRepository
            .createQueryBuilder('re')
            .leftJoinAndSelect('re.module', 'mod')
            .leftJoinAndSelect('re.originalBatch', 'ob')
            .leftJoinAndSelect('re.nextBatch', 'nb')
            .where('re.student = :sid', { sid: student.id })
            .andWhere('mod.id IN (:...mids)', { mids: moduleIds })
            .getMany();

          // Build per-module view
          const moduleResults = programModules.map(mod => {
            const best = bestByModule.get(mod.id) ?? null;
            const history = allResults.filter(r => r.module.id === mod.id);
            const pct = best ? Math.round((best.marks / best.maxMarks) * 100) : null;
            const gpaPoints = pct !== null ? percentageToGpaPoints(pct) : null;
            const repeat = repeats.find(re => re.module.id === mod.id) ?? null;

            return {
              moduleId:       mod.id,
              moduleCode:     mod.moduleCode,
              moduleName:     mod.moduleName,
              semesterNumber: mod.semesterNumber,
              credits:        mod.credits,
              hasResult:      !!best,
              marks:          best?.marks ?? null,
              maxMarks:       best?.maxMarks ?? null,
              percentage:     pct,
              grade:          best?.grade ?? null,
              gpaPoints,
              status:         best?.status ?? null,
              attemptNumber:  best?.attemptNumber ?? null,
              isRepeat:       best?.isRepeat ?? false,
              examDate:       best?.examDate ?? null,
              history,
              repeatEnrollment: repeat ? {
                id:            repeat.id,
                status:        repeat.status,
                hasPaid:       repeat.hasPaid,
                repeatFee:     repeat.repeatFee,
                nextBatch:     repeat.nextBatch,
                originalBatch: repeat.originalBatch,
                notifiedAt:    repeat.notifiedAt,
              } : null,
            };
          });

          // Overall GPA = average of gpaPoints (using credit-weighted if credits exist)
          const modulesWithResults = moduleResults.filter(m => m.gpaPoints !== null);
          let gpa = 0;
          if (modulesWithResults.length > 0) {
            const totalCredits = modulesWithResults.reduce((s, m) => s + (m.credits || 1), 0);
            const weightedSum  = modulesWithResults.reduce(
              (s, m) => s + (m.gpaPoints! * (m.credits || 1)), 0
            );
            gpa = Math.round((weightedSum / totalCredits) * 100) / 100;
          }

          const passedModules   = moduleResults.filter(m => m.status === ResultStatus.PASS).length;
          const failedModules   = moduleResults.filter(m => m.status === ResultStatus.FAIL).length;
          const pendingModules  = programModules.length - moduleResults.filter(m => m.hasResult).length;
          const isEligible      = passedModules === programModules.length && failedModules === 0;

          // Risk assessment across the 6 behavioural factors
          const risk = await computeRiskFactors(student.id, student.user.id, moduleIds);

          return {
            studentId:         student.id,
            universityNumber:  student.universityNumber,
            name:              `${student.user.firstName} ${student.user.lastName}`,
            firstName:         student.user.firstName,
            lastName:          student.user.lastName,
            email:             student.user.email,
            enrollmentStatus:  enr.status,
            totalModules:      programModules.length,
            passedModules,
            failedModules,
            pendingModules,
            gpa,
            gpaClass:          gpaToClass(gpa),
            isFirstClass:      gpa >= 3.70,
            isEligibleToGraduate: isEligible,
            moduleResults,
            risk,
          };
        })
      );

      // Summary stats
      const eligible    = studentRows.filter(s => s.isEligibleToGraduate).length;
      const firstClass  = studentRows.filter(s => s.isFirstClass && s.isEligibleToGraduate).length;
      const withRepeats = studentRows.filter(s => s.failedModules > 0).length;
      const highRisk    = studentRows.filter(s => s.risk.riskLevel === 'HIGH').length;
      const mediumRisk  = studentRows.filter(s => s.risk.riskLevel === 'MEDIUM').length;
      const lowRisk     = studentRows.filter(s => s.risk.riskLevel === 'LOW').length;

      res.json({
        status: 'success',
        data: {
          program:        { id: program.id, programCode: program.programCode, programName: program.programName },
          batch:          batch ? { id: batch.id, batchNumber: batch.batchNumber } : null,
          center:         center ? { id: center.id, centerName: center.centerName } : null,
          totalModules:   programModules.length,
          totalStudents:    studentRows.length,
          eligibleCount:    eligible,
          firstClassCount:  firstClass,
          withRepeatsCount: withRepeats,
          riskSummary: { highRisk, mediumRisk, lowRisk },
          students:         studentRows,
        },
      });
    } catch (error: any) {
      res.status(500).json({ status: 'error', message: error.message || 'Failed to generate graduation report' });
    }
  }

  // ── Repeat exam enrollments ───────────────────────────────────────────────

  /** POST /results/repeats  – register a student for a repeat exam */
  async createRepeatExamEnrollment(req: Request, res: Response) {
    try {
      const { studentId, moduleId, originalBatchId, nextBatchId, repeatFee } = req.body;

      const student = await this.studentRepository.findOne({ where: { id: studentId } });
      if (!student) return res.status(404).json({ status: 'error', message: 'Student not found' });

      const module = await this.moduleRepository.findOne({ where: { id: moduleId } });
      if (!module) return res.status(404).json({ status: 'error', message: 'Module not found' });

      // Check that the student actually failed this module
      const latestResult = await this.resultRepository.findOne({
        where: { student: { id: studentId }, module: { id: moduleId }, status: ResultStatus.FAIL },
      });
      if (!latestResult) {
        return res.status(400).json({ status: 'error', message: 'No failing result found for this student/module' });
      }

      // Prevent duplicate pending repeats
      const existing = await this.repeatEnrollRepository.findOne({
        where: {
          student: { id: studentId },
          module:  { id: moduleId },
          status:  RepeatExamStatus.PENDING,
        },
      });
      if (existing) {
        return res.status(409).json({ status: 'error', message: 'Repeat exam enrollment already exists' });
      }

      const originalBatch = originalBatchId
        ? await this.batchRepository.findOne({ where: { id: originalBatchId } })
        : null;
      const nextBatch = nextBatchId
        ? await this.batchRepository.findOne({ where: { id: nextBatchId } })
        : null;

      const re = this.repeatEnrollRepository.create({
        student,
        module,
        originalBatch,
        nextBatch,
        repeatFee: repeatFee ?? null,
        status: RepeatExamStatus.PENDING,
        hasPaid: false,
      });
      await this.repeatEnrollRepository.save(re);

      // Notify the student
      try {
        const sw = await this.studentRepository.findOne({ where: { id: studentId }, relations: ['user'] });
        if (sw) {
          await notificationService.createNotification({
            userId: sw.user.id,
            title:   `Repeat Exam Registered: ${module.moduleName}`,
            message: `You have been registered for a repeat exam in ${module.moduleName}.${
              nextBatch ? ` It will be held in batch ${nextBatch.batchNumber}.` : ''
            }${repeatFee ? ` Repeat fee: LKR ${repeatFee}.` : ''}`,
            type: NotificationType.EXAM,
            link: '/student/results',
            sendEmail: true,
          });
        }
      } catch { /* non-blocking */ }

      res.status(201).json({ status: 'success', message: 'Repeat exam enrollment created', data: { repeatEnrollment: re } });
    } catch (error: any) {
      res.status(500).json({ status: 'error', message: error.message || 'Failed to create repeat enrollment' });
    }
  }

  /** PATCH /results/repeats/:id – update payment status or next batch */
  async updateRepeatEnrollment(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { hasPaid, nextBatchId, repeatFee, status } = req.body;

      const re = await this.repeatEnrollRepository.findOne({
        where: { id },
        relations: ['student', 'student.user', 'module', 'nextBatch'],
      });
      if (!re) return res.status(404).json({ status: 'error', message: 'Repeat enrollment not found' });

      if (hasPaid !== undefined) re.hasPaid = hasPaid;
      if (repeatFee !== undefined) re.repeatFee = repeatFee;
      if (status) re.status = status;
      if (nextBatchId) {
        const nb = await this.batchRepository.findOne({ where: { id: nextBatchId } });
        if (nb) re.nextBatch = nb;
      }
      await this.repeatEnrollRepository.save(re);

      res.json({ status: 'success', message: 'Repeat enrollment updated', data: { repeatEnrollment: re } });
    } catch (error: any) {
      res.status(500).json({ status: 'error', message: error.message || 'Failed to update repeat enrollment' });
    }
  }

  /** GET /results/repeats – list repeat enrollments (admin/user, center-scoped for USER) */
  async getRepeatEnrollments(req: Request, res: Response) {
    try {
      const { programId, batchId, moduleId } = req.query as Record<string, string>;
      const user = (req as any).user;

      let centerId: string | undefined;
      if (user.role === Role.USER) {
        const staffUser = await AppDataSource.getRepository(
          require('../entities/User.entity').User
        ).findOne({ where: { id: user.userId }, relations: ['center'] });
        centerId = staffUser?.center?.id ?? undefined;
      }

      let qb = this.repeatEnrollRepository
        .createQueryBuilder('re')
        .leftJoinAndSelect('re.student', 'student')
        .leftJoinAndSelect('student.user', 'u')
        .leftJoinAndSelect('re.module', 'module')
        .leftJoinAndSelect('module.program', 'program')
        .leftJoinAndSelect('re.originalBatch', 'ob')
        .leftJoinAndSelect('re.nextBatch', 'nb')
        .leftJoin('ob.centers', 'obc');

      if (programId) qb = qb.andWhere('program.id = :programId', { programId });
      if (moduleId)  qb = qb.andWhere('module.id = :moduleId',   { moduleId });
      if (batchId)   qb = qb.andWhere('ob.id = :batchId',        { batchId });
      if (centerId)  qb = qb.andWhere('obc.id = :centerId',      { centerId });

      const repeats = await qb.orderBy('re.createdAt', 'DESC').getMany();

      res.json({ status: 'success', data: { repeats } });
    } catch (error: any) {
      res.status(500).json({ status: 'error', message: error.message || 'Failed to fetch repeat enrollments' });
    }
  }

  /**
   * POST /results/repeats/notify-batch
   * Notify all PAID students with a repeat enrollment for a module
   * when a next-batch exam is scheduled.
   * Body: { moduleId, nextBatchId }
   */
  async notifyRepeatStudentsForBatch(req: Request, res: Response) {
    try {
      const { moduleId, nextBatchId } = req.body;

      const module   = await this.moduleRepository.findOne({ where: { id: moduleId } });
      const nextBatch = await this.batchRepository.findOne({ where: { id: nextBatchId } });
      if (!module || !nextBatch) {
        return res.status(404).json({ status: 'error', message: 'Module or Batch not found' });
      }

      // Find all pending/paid repeat enrollments for this module
      const repeats = await this.repeatEnrollRepository.find({
        where: { module: { id: moduleId }, status: RepeatExamStatus.PENDING },
        relations: ['student', 'student.user'],
      });

      if (repeats.length === 0) {
        return res.json({ status: 'success', message: 'No pending repeat enrollments found', data: { notified: 0 } });
      }

      // Only notify students who have paid (if fee is set) or all if no fee set
      const toNotify = repeats.filter(r => !r.repeatFee || r.hasPaid);

      await Promise.allSettled(
        toNotify.map(async (r) => {
          await notificationService.createNotification({
            userId: r.student.user.id,
            title:  `Repeat Exam Scheduled: ${module.moduleName}`,
            message: `Your repeat exam for ${module.moduleName} has been scheduled in batch ${nextBatch.batchNumber}. ${
              r.repeatFee ? `Exam fee of LKR ${r.repeatFee} has been charged.` : ''
            } Please prepare accordingly.`,
            type:  NotificationType.EXAM,
            link:  '/student/results',
            sendEmail: true,
          });

          r.status     = RepeatExamStatus.NOTIFIED;
          r.nextBatch  = nextBatch;
          r.notifiedAt = new Date();
          await this.repeatEnrollRepository.save(r);
        })
      );

      res.json({
        status: 'success',
        message: `${toNotify.length} student(s) notified about repeat exam`,
        data: { notified: toNotify.length, skippedUnpaid: repeats.length - toNotify.length },
      });
    } catch (error: any) {
      res.status(500).json({ status: 'error', message: error.message || 'Failed to notify students' });
    }
  }

  // ── Student Risk Report ───────────────────────────────────────────────────

  /** GET /results/student-risk  – list all enrolled students with their risk profile */
  async getStudentRiskReport(req: Request, res: Response) {
    try {
      const { programId, batchId } = req.query as Record<string, string>;
      const user = (req as any).user;

      // Resolve centerId: USER role is forced to their own center
      let centerId: string | undefined;
      if (user.role === Role.USER) {
        centerId = user.centerId ?? undefined;
      } else {
        centerId = (req.query.centerId as string) || undefined;
      }

      // Build enrollment query with student + program (+ modules) + batch relations
      let qb = this.enrollmentRepository
        .createQueryBuilder('e')
        .leftJoinAndSelect('e.student', 'student')
        .leftJoinAndSelect('student.user', 'u')
        .leftJoinAndSelect('e.program', 'program')
        .leftJoinAndSelect('program.modules', 'module')
        .leftJoinAndSelect('e.batch', 'batch')
        .where('e.status = :status', { status: EnrollmentStatus.ACTIVE });

      if (programId) {
        qb = qb.andWhere('program.id = :programId', { programId });
      }
      if (batchId) {
        qb = qb.andWhere('batch.id = :batchId', { batchId });
      }
      if (centerId) {
        qb = qb
          .leftJoin('batch.centers', 'bc')
          .andWhere('bc.id = :centerId', { centerId });
      }

      const enrollments = await qb.getMany();

      // Deduplicate: keep one enrollment per (studentId, programId)
      // A student can be in the same program across multiple batches — take the last one
      const dedupMap = new Map<string, typeof enrollments[0]>();
      for (const enr of enrollments) {
        const key = `${enr.student.id}::${enr.program.id}`;
        dedupMap.set(key, enr);
      }
      const uniqueEnrollments = Array.from(dedupMap.values());

      // Compute risk for each student in their program context
      const studentRows = await Promise.all(
        uniqueEnrollments.map(async (enr) => {
          const student  = enr.student;
          const program  = enr.program;
          const batch    = enr.batch;
          const moduleIds: string[] = (program.modules ?? []).map((m: any) => m.id);

          const risk = await computeRiskFactors(student.id, student.user.id, moduleIds);

          return {
            studentId:        student.id,
            universityNumber: student.universityNumber,
            name:             `${student.user.firstName} ${student.user.lastName}`,
            email:            student.user.email,
            program: {
              id:          program.id,
              programCode: program.programCode,
              programName: program.programName,
            },
            batch: batch ? {
              id:          batch.id,
              batchNumber: batch.batchNumber,
            } : null,
            enrollmentStatus: enr.status,
            risk,
          };
        })
      );

      const highRisk   = studentRows.filter(s => s.risk.riskLevel === 'HIGH').length;
      const mediumRisk = studentRows.filter(s => s.risk.riskLevel === 'MEDIUM').length;
      const lowRisk    = studentRows.filter(s => s.risk.riskLevel === 'LOW').length;

      res.json({
        status: 'success',
        data: {
          summary: { total: studentRows.length, highRisk, mediumRisk, lowRisk },
          students: studentRows,
        },
      });
    } catch (error: any) {
      res.status(500).json({ status: 'error', message: error.message || 'Failed to generate student risk report' });
    }
  }

  /** POST /results/student-risk/notify  – send risk alert notifications to given students */
  async notifyRiskStudents(req: Request, res: Response) {
    try {
      const { studentIds, title, message } = req.body as {
        studentIds: string[];
        title: string;
        message: string;
      };

      if (!Array.isArray(studentIds) || studentIds.length === 0) {
        return res.status(400).json({ status: 'error', message: 'studentIds array is required' });
      }
      if (!title?.trim() || !message?.trim()) {
        return res.status(400).json({ status: 'error', message: 'title and message are required' });
      }

      const students = await this.studentRepository.find({
        where: studentIds.map(id => ({ id })),
        relations: ['user'],
      });

      if (students.length === 0) {
        return res.status(404).json({ status: 'error', message: 'No students found for the provided IDs' });
      }

      const userIds = students.map(s => s.user.id);
      await notificationService.createNotifications({
        userIds,
        title,
        message,
        type:      NotificationType.AI_ALERT,
        link:      '/student/results',
        sendEmail: true,
      });

      res.json({
        status:  'success',
        message: `Notifications sent to ${students.length} student(s)`,
        data:    { notified: students.length },
      });
    } catch (error: any) {
      res.status(500).json({ status: 'error', message: error.message || 'Failed to send notifications' });
    }
  }
}

export default new ResultController();
