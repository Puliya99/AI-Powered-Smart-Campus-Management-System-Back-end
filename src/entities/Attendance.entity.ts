import { AttendanceStatus } from '../enums/AttendanceStatus.enum';
import { Entity, PrimaryGeneratedColumn, ManyToOne, Column, CreateDateColumn, UpdateDateColumn } from "typeorm";
import { Schedule } from "./Schedule.entity";
import { Student } from "./Student.entity";

@Entity()
export class Attendance {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Student, student => student.attendances)
  student: Student;

  @ManyToOne(() => Schedule, schedule => schedule.attendances)
  schedule: Schedule;

  @Column({ type: 'enum', enum: AttendanceStatus })
  status: AttendanceStatus;

  // Timestamp when attendance was first marked (entry)
  @Column({ type: 'timestamp', nullable: true })
  markedAt: Date;

  // Explicit entry and exit timestamps for fingerprint scans
  @Column({ type: 'timestamp', nullable: true })
  entryTime: Date;

  @Column({ type: 'timestamp', nullable: true })
  exitTime: Date;

  @Column({ type: 'text', nullable: true })
  remarks: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
