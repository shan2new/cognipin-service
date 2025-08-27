import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm'
import { Company } from './company.entity'
import { Platform } from './platform.entity'

@Entity({ name: 'application_draft' })
@Index('idx_app_draft_user', ['user_id'])
export class ApplicationDraft {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  @Column({ type: 'text' })
  user_id!: string

  @Column({ type: 'uuid', nullable: true })
  company_id!: string | null

  @ManyToOne(() => Company)
  @JoinColumn({ name: 'company_id' })
  company?: Company | null

  @Column({ type: 'text', nullable: true })
  role!: string | null

  @Column({ type: 'text', nullable: true })
  job_url!: string | null

  @Column({ type: 'uuid', nullable: true })
  platform_id!: string | null

  @ManyToOne(() => Platform)
  @JoinColumn({ name: 'platform_id' })
  platform?: Platform | null

  @Column({ type: 'text', nullable: true })
  source!: 'applied_self' | 'applied_referral' | 'recruiter_outreach' | null

  @Column({ type: 'jsonb', nullable: true })
  compensation!: {
    fixed_min_lpa?: number | null
    fixed_max_lpa?: number | null
    var_min_lpa?: number | null
    var_max_lpa?: number | null
    note?: string | null
  } | null

  @Column({ type: 'jsonb', nullable: true })
  notes!: string[] | null

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at!: Date
}


