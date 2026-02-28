import { RiskLevel } from '../enums/RiskLevel.enum';
import { Entity, PrimaryGeneratedColumn, ManyToOne, Column, CreateDateColumn, UpdateDateColumn } from "typeorm";
import { Student } from "./Student.entity";

@Entity()
export class Prediction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Student)
  student: Student;

  @Column({ type: 'varchar', length: 50 })
  predictionType: string; // PERFORMANCE, EXAM_ELIGIBILITY, DROPOUT_RISK

  @Column({ type: 'decimal', precision: 5, scale: 2 })
  riskScore: number; // 0-100

  @Column({ type: 'enum', enum: RiskLevel })
  riskLevel: RiskLevel; // LOW, MEDIUM, HIGH

  @Column({ type: 'json', nullable: true })
  factors: object; // Contributing factors

  @Column({ type: 'text', nullable: true })
  recommendation: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  modelVersion: string;

  @Column({ type: 'date' })
  predictionDate: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
