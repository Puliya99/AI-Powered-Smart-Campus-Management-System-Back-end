import { PaymentType } from '../enums/PaymentType.enum';
import { Entity, PrimaryGeneratedColumn, OneToOne, JoinColumn, Column, OneToMany, CreateDateColumn, UpdateDateColumn } from "typeorm";
import { Attendance } from "./Attendance.entity";
import { Enrollment } from "./Enrollment.entity";
import { Feedback } from "./Feedback.entity";
import { Payment } from "./Payment.entity";
import { Result } from "./Result.entity";
import { User } from "./User.entity";
import { Submission } from "./Submission.entity";
import { WebAuthnCredential } from "./WebAuthnCredential.entity";

@Entity()
export class Student {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @OneToOne(() => User, user => user.student)
  @JoinColumn()
  user: User;

  @Column({ type: 'varchar', length: 50, unique: true })
  universityNumber: string;

  // Unique ID coming from the fingerprint device enrollment (e.g., template/user ID)
  @Column({ type: 'varchar', length: 100, unique: true, nullable: true })
  fingerprintId: string | null;

  // 6-digit numeric passkey for kiosk identification (like Gym Pro)
  @Column({ type: 'integer', unique: true, nullable: true })
  passkey: number | null;

  // Audit trail for passkey regeneration
  @Column({ type: 'timestamp', nullable: true })
  passkeyRegeneratedAt: Date | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  passkeyRegeneratedBy: string | null;

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

  @OneToMany(() => WebAuthnCredential, credential => credential.student)
  webauthnCredentials: WebAuthnCredential[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
