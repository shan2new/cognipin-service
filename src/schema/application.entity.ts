import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm'
import { Company } from './company.entity'
import { Platform } from './platform.entity'

export type ApplicationSource = 'applied_self' | 'applied_referral' | 'recruiter_outreach'
export type ApplicationMilestone = 'exploration' | 'interviewing' | 'post_interview'
export type ApplicationStage =
  | 'recruiter_outreach'
  | 'applied_self'
  | 'applied_referral'
  | 'recruiter_discussion'
  | 'pending_shortlist'
  | 'interview_shortlist'
  | 'interview_scheduled'
  | 'interview_rescheduled'
  | 'interview_completed'
  | 'interview_passed'
  | 'interview_rejected'
  | 'offer'
  | 'rejected'
  | 'on_hold'
  | 'withdrawn'
  | 'accepted'
export type ApplicationStatus = 'active' | 'rejected' | 'offer' | 'accepted' | 'withdrawn' | 'on_hold'

@Entity({ name: 'application' })
@Index('idx_application_stage', ['stage'])
@Index('idx_application_milestone', ['milestone'])
@Index('idx_application_platform', ['platform_id'])
@Index('idx_application_company', ['company_id'])
export class Application {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  @Column({ type: 'text' })
  user_id!: string

  @Column({ type: 'uuid' })
  company_id!: string

  @ManyToOne(() => Company)
  @JoinColumn({ name: 'company_id' })
  company?: Company

  @Column({ type: 'text' })
  role!: string

  @Column({ type: 'text', nullable: true })
  job_url!: string | null

  @Column({ type: 'uuid', nullable: true })
  platform_id!: string | null

  @ManyToOne(() => Platform)
  @JoinColumn({ name: 'platform_id' })
  platform?: Platform | null

  @Column({ type: 'enum', enumName: 'application_source', enum: ['applied_self', 'applied_referral', 'recruiter_outreach'] })
  source!: ApplicationSource

  @Column({ type: 'enum', enumName: 'application_milestone', enum: ['exploration', 'interviewing', 'post_interview'] })
  milestone!: ApplicationMilestone

  @Column({
    type: 'enum',
    enumName: 'application_stage',
    enum: [
      'recruiter_outreach',
      'applied_self',
      'applied_referral',
      'recruiter_discussion',
      'pending_shortlist',
      'interview_shortlist',
      'interview_scheduled',
      'interview_rescheduled',
      'interview_completed',
      'interview_passed',
      'interview_rejected',
      'offer',
      'rejected',
      'on_hold',
      'withdrawn',
      'accepted',
    ],
  })
  stage!: ApplicationStage

  @Column({ type: 'enum', enumName: 'application_status', enum: ['active', 'rejected', 'offer', 'accepted', 'withdrawn', 'on_hold'], default: 'active' })
  status!: ApplicationStatus

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date

  @Column({ type: 'timestamptz' })
  last_activity_at!: Date

  @Column({ type: 'text', nullable: true })
  notes!: string | null

  @Column({ type: 'text', nullable: true })
  resume_variant!: string | null
}


