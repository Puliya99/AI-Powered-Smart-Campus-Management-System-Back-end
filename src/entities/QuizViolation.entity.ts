import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn } from "typeorm";
import { QuizAttempt } from "./QuizAttempt.entity";

@Entity('quiz_violations')
export class QuizViolation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => QuizAttempt)
  attempt: QuizAttempt;

  @Column({ type: 'varchar', length: 50 })
  violationType: string; // 'NO_FACE', 'MULTIPLE_FACES', 'CAMERA_DISABLED'

  @Column({ type: 'text', nullable: true })
  details: string | null;

  @CreateDateColumn()
  timestamp: Date;
}
