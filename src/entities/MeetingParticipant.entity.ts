import { Entity, PrimaryGeneratedColumn, ManyToOne, Column, CreateDateColumn } from "typeorm";
import { VideoMeeting } from "./VideoMeeting.entity";
import { User } from "./User.entity";

@Entity('meeting_participants')
export class MeetingParticipant {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => VideoMeeting, meeting => meeting.participants)
  meeting: VideoMeeting;

  @ManyToOne(() => User)
  user: User;

  @Column({ type: 'varchar', length: 20 })
  role: string; // HOST (Lecturer) or PARTICIPANT (Student)

  @CreateDateColumn()
  joinedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  leftAt: Date;
}
