import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
  ManyToMany,
  JoinTable,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Enrollment } from './Enrollment.entity';
import { Module } from './Module.entity';
import { Batch } from './Batch.entity';
import { Payment } from './Payment.entity';
import { Center } from './Center.entity';

@Entity('programs')
export class Program {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 20, unique: true })
  programCode: string;

  @Column({ type: 'varchar', length: 200 })
  programName: string;

  @Column({ type: 'varchar', length: 50 })
  duration: string; // e.g., "3 years", "6 months"

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  programFee: number;

  @Column({ type: 'text', nullable: true })
  description: string;

  @OneToMany(() => Module, module => module.program)
  modules: Module[];

  @OneToMany(() => Batch, batch => batch.program)
  batches: Batch[];

  @OneToMany(() => Enrollment, enrollment => enrollment.program)
  enrollments: Enrollment[];

  @OneToMany(() => Payment, payment => payment.program)
  payments: Payment[];

  @ManyToMany(() => Center, center => center.programs)
  @JoinTable({
    name: 'program_centers',
    joinColumn: { name: 'program_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'center_id', referencedColumnName: 'id' }
  })
  centers: Center[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
