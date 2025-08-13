import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm'
import { Problem } from './problem.entity'

@Entity({ name: 'problem_attempts' })
export class ProblemAttempt {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  @Column({ name: 'user_id', type: 'varchar' })
  userId!: string

  @ManyToOne(() => Problem, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'problem_id' })
  problem!: Problem

  @Column({ name: 'problem_id', type: 'varchar' })
  problemId!: string

  @Column({ type: 'enum', enum: ['Attempted', 'Solved'] })
  status!: 'Attempted' | 'Solved'

  @Column({ name: 'time_taken_minutes', type: 'int', nullable: true })
  timeTakenMinutes?: number

  @CreateDateColumn({ type: 'timestamptz', name: 'attempted_at' })
  attemptedAt!: Date
}


