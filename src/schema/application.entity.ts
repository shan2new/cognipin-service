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
import { ApplicationCompensation } from './application-compensation.entity'

export type ApplicationSource = 'applied_self' | 'applied_referral' | 'recruiter_outreach'
export type ApplicationMilestone = 'exploration' | 'screening' | 'interviewing' | 'post_interview'
export type ApplicationStage =
  | 'wishlist'
  | 'recruiter_reachout'
  | 'self_review'
  | 'hr_shortlist'
  | 'hm_shortlist'
  | 'offer'
  | string // Allow dynamic interview round stages like 'interview_round_1', 'interview_round_2', etc.
export type ApplicationStatus = 'active' | 'rejected' | 'offer' | 'accepted' | 'withdrawn' | 'on_hold'

@Entity({ name: 'application' })
@Index('idx_application_stage', ['stage'])
@Index('idx_application_milestone', ['milestone'])
@Index('idx_application_platform', ['platform_id'])
@Index('idx_application_company', ['company_id'])
@Index('uq_user_platform_job', ['user_id','platform_id','platform_job_id'], { unique: true })
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

  // Unique per user + platform to prevent duplicates when sourced via platform pages
  @Column({ type: 'text', nullable: true })
  platform_job_id?: string | null

  @Column({ type: 'enum', enumName: 'application_source', enum: ['applied_self', 'applied_referral', 'recruiter_outreach'] })
  source!: ApplicationSource

  @Column({ type: 'enum', enumName: 'application_milestone', enum: ['exploration', 'screening', 'interviewing', 'post_interview'] })
  milestone!: ApplicationMilestone

  @Column({ type: 'text' })
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

  @OneToOne(() => ApplicationCompensation, (compensation) => compensation.application)
  compensation?: ApplicationCompensation

  // New optional fields populated during extraction
  @Column({ type: 'text', nullable: true })
  job_location_city?: string | null

  @Column({ type: 'text', nullable: true })
  job_location_country?: string | null

  @Column({ type: 'text', nullable: true })
  work_location_type?: 'onsite' | 'hybrid' | 'remote' | null

  // Soft archive flag: when true, application is hidden from default lists
  @Column({ type: 'boolean', nullable: true })
  is_archived?: boolean | null
}


