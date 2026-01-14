import { PaymentType } from '../enums/PaymentType.enum';
import { Entity, PrimaryGeneratedColumn, OneToOne, JoinColumn, Column, OneToMany, CreateDateColumn, UpdateDateColumn } from "typeorm";
import { Attendance } from "./Attendance.entity";
import { Enrollment } from "./Enrollment.entity";
import { Feedback } from "./Feedback.entity";
import { Payment } from "./Payment.entity";
import { Result } from "./Result.entity";
import { User } from "./User.entity";
import { Submission } from "./Submission.entity";

@Entity()
export class Student {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @OneToOne(() => User)
  @JoinColumn()
  user: User;

  @Column({ type: 'varchar', length: 50, unique: true })
  universityNumber: string;

  @Column({ type: 'enum', enum: PaymentType, default: PaymentType.FULL })
  paymentType: PaymentType;

  @OneToMany(() => Enrollment, enrollment => enrollment.student)
  enrollments: Enrollment[];

  @OneToMany(() => Attendance, attendance => attendance.student)
  attendances: Attendance[];

  @OneToMany(() => Payment, payment => payment.student)
  payments: Payment[];

  @OneToMany(() => Result, result => result.student)
  results: Result[];

  @OneToMany(() => Feedback, feedback => feedback.student)
  feedbacks: Feedback[];

  @OneToMany(() => Submission, submission => submission.student)
  submissions: Submission[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
