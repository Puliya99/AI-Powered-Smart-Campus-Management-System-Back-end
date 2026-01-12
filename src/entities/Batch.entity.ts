import { BatchStatus } from '../enums/BatchStatus.enum';
import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, OneToMany, CreateDateColumn, UpdateDateColumn } from "typeorm";
import { Enrollment } from "./Enrollment.entity";
import { Program } from "./Program.entity";
import { Schedule } from "./Schedule.entity";

@Entity()
export class Batch {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 50, unique: true })
  batchNumber: string; // e.g., "BATCH_2024_01"

  @Column({ type: 'date' })
  startDate: Date;

  @Column({ type: 'date', nullable: true })
  endDate: Date;

  @ManyToOne(() => Program, program => program.batches)
  program: Program;

  @OneToMany(() => Enrollment, enrollment => enrollment.batch)
  enrollments: Enrollment[];

  @OneToMany(() => Schedule, schedule => schedule.batch)
  schedules: Schedule[];

  @Column({ type: 'enum', enum: BatchStatus, default: BatchStatus.ACTIVE })
  status: BatchStatus;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
