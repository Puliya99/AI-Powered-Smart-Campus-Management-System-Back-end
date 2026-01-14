import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, OneToMany, CreateDateColumn, UpdateDateColumn } from "typeorm";
import { Module } from "./Module.entity";
import { Lecturer } from "./Lecturer.entity";
import { MeetingParticipant } from "./MeetingParticipant.entity";

@Entity('video_meetings')
export class VideoMeeting {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 200 })
  title: string;

  @ManyToOne(() => Module)
  module: Module;

  @ManyToOne(() => Lecturer)
  lecturer: Lecturer;

  @Column({ type: 'varchar', length: 50, unique: true })
  meetingCode: string;

  @Column({ type: 'timestamp' })
  startTime: Date;

  @Column({ type: 'timestamp', nullable: true })
  endTime: Date;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @OneToMany(() => MeetingParticipant, participant => participant.meeting)
  participants: MeetingParticipant[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
