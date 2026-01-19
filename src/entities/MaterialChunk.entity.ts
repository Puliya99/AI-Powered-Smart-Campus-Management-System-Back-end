import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn, UpdateDateColumn } from "typeorm";
import { LectureNote } from "./LectureNote.entity";

@Entity()
export class MaterialChunk {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => LectureNote, note => (note as any).chunks, { onDelete: 'CASCADE' })
  lectureNote: LectureNote;

  @Column({ type: 'text' })
  content: string;

  @Column({ type: 'int' })
  chunkIndex: number;

  @Column({ type: 'jsonb', nullable: true })
  metadata: {
    page?: number;
    slide?: number;
    sectionTitle?: string;
  };

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
