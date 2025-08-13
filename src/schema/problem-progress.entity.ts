import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm'
import { Problem } from './problem.entity'

export type ProblemStatus = 'Not Started' | 'Attempted' | 'Solved'

@Entity({ name: 'problem_progress' })
@Index(['userId', 'problemId'], { unique: true })
export class ProblemProgress {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  @Column({ name: 'user_id', type: 'varchar' })
  userId!: string

  @ManyToOne(() => Problem, (p: Problem) => p.progresses, { eager: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'problem_id' })
  problem!: Problem

  @Column({ name: 'problem_id', type: 'varchar' })
  problemId!: string

  @Column({ type: 'enum', enum: ['Not Started', 'Attempted', 'Solved'], default: 'Not Started' })
  status!: ProblemStatus

  @Column({ type: 'boolean', default: false })
  revisit!: boolean

  @Column({ name: 'personal_difficulty', type: 'enum', enum: ['easier', 'same', 'harder'], nullable: true })
  personalDifficulty?: 'easier' | 'same' | 'harder'

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt!: Date
}


