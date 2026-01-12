import { Request, Response } from 'express';
import { AppDataSource } from '../config/database';
import { Payment } from '../entities/Payment.entity';
import { Student } from '../entities/Student.entity';
import { Program } from '../entities/Program.entity';
import { Center } from '../entities/Center.entity';
import { PaymentMethod } from '../enums/PaymentMethod.enum';
import { PaymentStatus } from '../enums/PaymentStatus.enum';
import { uploadSingle } from '../middleware/upload.middleware';

export class PaymentController {
  private paymentRepository = AppDataSource.getRepository(Payment);
  private studentRepository = AppDataSource.getRepository(Student);
  private programRepository = AppDataSource.getRepository(Program);
  private centerRepository = AppDataSource.getRepository(Center);

  // Get all payments with pagination and filters
  async getAllPayments(req: Request, res: Response) {
    try {
      const {
        page = 1,
        limit = 10,
        search = '',
        studentId = '',
        programId = '',
        centerId = '',
        status = '',
        method = '',
        sortBy = 'paymentDate',
        sortOrder = 'DESC',
      } = req.query;

      const skip = (Number(page) - 1) * Number(limit);

      const queryBuilder = this.paymentRepository
        .createQueryBuilder('payment')
        .leftJoinAndSelect('payment.student', 'student')
        .leftJoinAndSelect('student.user', 'studentUser')
        .leftJoinAndSelect('payment.program', 'program')
        .leftJoinAndSelect('payment.center', 'center')
        .skip(skip)
        .take(Number(limit))
        .orderBy(`payment.${sortBy}`, sortOrder as 'ASC' | 'DESC');

      // Search filter
      if (search) {
        queryBuilder.where(
          '(studentUser.firstName ILIKE :search OR studentUser.lastName ILIKE :search OR payment.transactionId ILIKE :search)',
          { search: `%${search}%` }
        );
      }

      // Student filter
      if (studentId) {
        queryBuilder.andWhere('payment.studentId = :studentId', { studentId });
      }

      // Program filter
      if (programId) {
        queryBuilder.andWhere('payment.programId = :programId', { programId });
      }

      // Center filter
      if (centerId) {
        queryBuilder.andWhere('payment.center_id = :centerId', { centerId });
      }

      // Status filter
      if (status) {
        queryBuilder.andWhere('payment.status = :status', { status });
      }

      // Method filter
      if (method) {
        queryBuilder.andWhere('payment.paymentMethod = :method', { method });
      }

      const [payments, total] = await queryBuilder.getManyAndCount();

      res.json({
        status: 'success',
        data: {
          payments,
          pagination: {
            page: Number(page),
            limit: Number(limit),
            total,
            pages: Math.ceil(total / Number(limit)),
          },
        },
      });
    } catch (error: any) {
      res.status(500).json({
        status: 'error',
        message: error.message || 'Failed to fetch payments',
      });
    }
  }

  // Get payment by ID
  async getPaymentById(req: Request, res: Response) {
    try {
      const { id } = req.params;

      const payment = await this.paymentRepository.findOne({
        where: { id },
        relations: ['student', 'student.user', 'program', 'center'],
      });

      if (!payment) {
        return res.status(404).json({
          status: 'error',
          message: 'Payment not found',
        });
      }

      res.json({
        status: 'success',
        data: { payment },
      });
    } catch (error: any) {
      res.status(500).json({
        status: 'error',
        message: error.message || 'Failed to fetch payment',
      });
    }
  }

  // Create new payment
  async createPayment(req: Request, res: Response) {
    try {
      const {
        studentId,
        programId,
        centerId,
        amount,
        paymentMethod,
        transactionId,
        nextPaymentDate,
        outstanding,
        status,
        remarks,
      } = req.body;

      // Verify student exists
      const student = await this.studentRepository.findOne({
        where: { id: studentId },
      });

      if (!student) {
        return res.status(404).json({
          status: 'error',
          message: 'Student not found',
        });
      }

      // Verify program exists
      const program = await this.programRepository.findOne({
        where: { id: programId },
      });

      if (!program) {
        return res.status(404).json({
          status: 'error',
          message: 'Program not found',
        });
      }

      // Verify center exists
      let center = null;
      if (centerId) {
        center = await this.centerRepository.findOne({
          where: { id: centerId },
        });

        if (!center) {
          return res.status(404).json({
            status: 'error',
            message: 'Center not found',
          });
        }
      }

      // Create payment entity using new instance
      const payment = new Payment();
      payment.student = student;
      payment.program = program;
      payment.center = center;
      payment.paymentDate = new Date();
      payment.amount = parseFloat(amount);
      payment.paymentMethod = paymentMethod;
      payment.transactionId = transactionId || null;
      payment.nextPaymentDate = nextPaymentDate ? new Date(nextPaymentDate) : null;
      payment.outstanding = outstanding ? parseFloat(outstanding) : 0;
      payment.status = status || PaymentStatus.PAID;
      payment.remarks = remarks || null;

      // Save payment
      await this.paymentRepository.save(payment);

      // Fetch complete payment with relations
      const completePayment = await this.paymentRepository.findOne({
        where: { id: payment.id },
        relations: ['student', 'student.user', 'program', 'center'],
      });

      res.status(201).json({
        status: 'success',
        message: 'Payment created successfully',
        data: { payment: completePayment },
      });
    } catch (error: any) {
      res.status(400).json({
        status: 'error',
        message: error.message || 'Failed to create payment',
      });
    }
  }

  // Update payment
  async updatePayment(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const {
        centerId,
        amount,
        paymentMethod,
        transactionId,
        nextPaymentDate,
        outstanding,
        status,
        remarks,
      } = req.body;

      const payment = await this.paymentRepository.findOne({
        where: { id },
        relations: ['student', 'program', 'center'],
      });

      if (!payment) {
        return res.status(404).json({
          status: 'error',
          message: 'Payment not found',
        });
      }

      // Update fields only if provided
      if (amount !== undefined) {
        payment.amount = parseFloat(amount);
      }
      if (paymentMethod !== undefined) {
        payment.paymentMethod = paymentMethod;
      }
      if (transactionId !== undefined) {
        payment.transactionId = transactionId || null;
      }
      if (nextPaymentDate !== undefined) {
        payment.nextPaymentDate = nextPaymentDate ? new Date(nextPaymentDate) : null;
      }
      if (outstanding !== undefined) {
        payment.outstanding = parseFloat(outstanding);
      }
      if (status !== undefined) {
        payment.status = status;
      }
      if (remarks !== undefined) {
        payment.remarks = remarks || null;
      }

      // Update center if centerId provided
      if (centerId) {
        const center = await this.centerRepository.findOne({
          where: { id: centerId },
        });

        if (!center) {
          return res.status(404).json({
            status: 'error',
            message: 'Center not found',
          });
        }

        payment.center = center;
      }

      // Save updated payment
      await this.paymentRepository.save(payment);

      // Fetch updated payment with relations
      const updatedPayment = await this.paymentRepository.findOne({
        where: { id: payment.id },
        relations: ['student', 'student.user', 'program', 'center'],
      });

      res.json({
        status: 'success',
        message: 'Payment updated successfully',
        data: { payment: updatedPayment },
      });
    } catch (error: any) {
      res.status(400).json({
        status: 'error',
        message: error.message || 'Failed to update payment',
      });
    }
  }

  // Delete payment
  async deletePayment(req: Request, res: Response) {
    try {
      const { id } = req.params;

      const payment = await this.paymentRepository.findOne({ where: { id } });

      if (!payment) {
        return res.status(404).json({
          status: 'error',
          message: 'Payment not found',
        });
      }

      await this.paymentRepository.remove(payment);

      res.json({
        status: 'success',
        message: 'Payment deleted successfully',
      });
    } catch (error: any) {
      res.status(400).json({
        status: 'error',
        message: error.message || 'Failed to delete payment',
      });
    }
  }

  // Get payment statistics
  async getPaymentStats(req: Request, res: Response) {
    try {
      const totalPayments = await this.paymentRepository.count();

      const paidCount = await this.paymentRepository.count({
        where: { status: PaymentStatus.PAID },
      });

      const partialCount = await this.paymentRepository.count({
        where: { status: PaymentStatus.PARTIAL },
      });

      const overdueCount = await this.paymentRepository.count({
        where: { status: PaymentStatus.OVERDUE },
      });

      const unpaidCount = await this.paymentRepository.count({
        where: { status: PaymentStatus.UNPAID },
      });

      // Calculate total amount
      const totalAmountQuery = await this.paymentRepository
        .createQueryBuilder('payment')
        .select('SUM(payment.amount)', 'total')
        .getRawOne();

      const totalAmount = parseFloat(totalAmountQuery?.total || '0');

      res.json({
        status: 'success',
        data: {
          totalPayments,
          paidCount,
          partialCount,
          overdueCount,
          unpaidCount,
          totalAmount,
        },
      });
    } catch (error: any) {
      res.status(500).json({
        status: 'error',
        message: error.message || 'Failed to fetch statistics',
      });
    }
  }

  // Upload payment receipt
  async uploadReceipt(req: Request, res: Response) {
    uploadSingle('receipt')(req, res, async (err: any) => {
      if (err) {
        return res.status(400).json({
          status: 'error',
          message: err.message,
        });
      }

      try {
        const { paymentId } = req.params;
        const file = req.file;

        if (!file) {
          return res.status(400).json({
            status: 'error',
            message: 'No file uploaded',
          });
        }

        const payment = await this.paymentRepository.findOne({
          where: { id: paymentId },
          relations: ['student', 'student.user', 'program'],
        });

        if (!payment) {
          return res.status(404).json({
            status: 'error',
            message: 'Payment not found',
          });
        }

        // Update payment with receipt information
        const receiptInfo = `Receipt uploaded: ${file.filename}`;
        payment.remarks = payment.remarks ? `${payment.remarks}; ${receiptInfo}` : receiptInfo;
        payment.status = PaymentStatus.PAID;

        await this.paymentRepository.save(payment);

        res.json({
          status: 'success',
          message: 'Receipt uploaded successfully',
          data: {
            payment,
            receiptUrl: `/uploads/${file.filename}`,
          },
        });
      } catch (error: any) {
        res.status(400).json({
          status: 'error',
          message: error.message || 'Failed to upload receipt',
        });
      }
    });
  }

  // Get student payments (for logged-in student)
  async getStudentPayments(req: Request, res: Response) {
    try {
      const userId = (req as any).user.userId;

      const student = await this.studentRepository.findOne({
        where: { user: { id: userId } },
      });

      if (!student) {
        return res.status(404).json({
          status: 'error',
          message: 'Student not found',
        });
      }

      const payments = await this.paymentRepository.find({
        where: { student: { id: student.id } },
        relations: ['program'],
        order: { paymentDate: 'DESC' },
      });

      res.json({
        status: 'success',
        data: { payments },
      });
    } catch (error: any) {
      res.status(500).json({
        status: 'error',
        message: error.message || 'Failed to fetch payments',
      });
    }
  }
}

export default new PaymentController();
