import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm'

export type InterviewRoundType = 'screen' | 'dsa' | 'system_design' | 'coding' | 'hm' | 'bar_raiser' | 'other'
export type InterviewRoundResult = 'passed' | 'rejected' | 'no_show' | 'pending'
export type InterviewRoundStatus = 'unscheduled' | 'scheduled' | 'rescheduled' | 'completed' | 'rejected' | 'withdrawn'
export type InterviewRoundMode = 'online' | 'onsite'

@Entity({ name: 'interview_round' })
export class InterviewRound {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  @Column('uuid')
  application_id!: string

  @Column('int')
  round_index!: number

  @Column({ type: 'text', nullable: true })
  custom_name!: string | null

  @Column({ type: 'enum', enumName: 'interview_round_type', enum: ['screen', 'dsa', 'system_design', 'coding', 'hm', 'bar_raiser', 'other'], default: 'dsa' })
  type!: InterviewRoundType

  @Column({ type: 'enum', enumName: 'interview_round_status', enum: ['unscheduled', 'scheduled', 'rescheduled', 'completed', 'rejected', 'withdrawn'], default: 'unscheduled' })
  status!: InterviewRoundStatus

  @Column({ type: 'timestamptz', nullable: true })
  scheduled_at!: Date | null

  @Column({ type: 'int', default: 0 })
  rescheduled_count!: number

  @Column({ type: 'timestamptz', nullable: true })
  started_at!: Date | null

  @Column({ type: 'timestamptz', nullable: true })
  completed_at!: Date | null

  @Column({ type: 'enum', enumName: 'interview_round_result', enum: ['passed', 'rejected', 'no_show', 'pending'], default: 'pending' })
  result!: InterviewRoundResult

  @Column({ type: 'text', nullable: true })
  feedback!: string | null

  @Column({ type: 'text', nullable: true })
  rejection_reason!: string | null

  @Column({ type: 'enum', enumName: 'interview_round_mode', enum: ['online', 'onsite'], default: 'online' })
  mode!: InterviewRoundMode
}


