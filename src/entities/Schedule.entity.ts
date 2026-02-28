import { ScheduleStatus } from '../enums/ScheduleStatus.enum';
import { ScheduleType } from '../enums/ScheduleType.enum';
import { Entity, PrimaryGeneratedColumn, ManyToOne, Column, OneToMany, CreateDateColumn, UpdateDateColumn } from "typeorm";
import { Attendance } from "./Attendance.entity";
import { Center } from "./Center.entity";
import { Lecturer } from "./Lecturer.entity";
import { Module } from "./Module.entity";
import { Batch } from "./Batch.entity";

@Entity()
export class Schedule {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Module, module => module.schedules)
  module: Module;

  @ManyToOne(() => Batch, batch => batch.schedules)
  batch: Batch;

  @ManyToOne(() => Lecturer, lecturer => lecturer.schedules)
  lecturer: Lecturer;

  @ManyToOne(() => Center, center => center.schedules)
  center: Center;

  @Column({ type: 'date' })
  date: Date;

  @Column({ type: 'varchar', length: 20 })
  startTime: string; // e.g., "09:00"

  @Column({ type: 'varchar', length: 20 })
  endTime: string; // e.g., "11:00"

  @Column({ type: 'varchar', length: 50 })
  lectureHall: string;

  @Column({ type: 'enum', enum: ScheduleStatus, default: ScheduleStatus.SCHEDULED })
  status: ScheduleStatus;

  @Column({ type: 'enum', enum: ScheduleType, default: ScheduleType.PHYSICAL })
  type: ScheduleType;

  @OneToMany(() => Attendance, attendance => attendance.schedule)
  attendances: Attendance[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
