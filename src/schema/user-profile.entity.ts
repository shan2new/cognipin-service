import { Column, Entity, PrimaryGeneratedColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm'
import { Company } from './company.entity'
import { Role } from './role.entity'

@Entity({ name: 'user_profile' })
export class UserProfile {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  @Column('text', { unique: true })
  user_id!: string

  @Column('int', { nullable: true })
  notice_period_days!: number | null

  @Column('date', { nullable: true })
  earliest_join_date!: string | null

  @Column('text', { nullable: true })
  theme!: 'light' | 'dark' | null

  @Column('text', { nullable: true })
  current_role!: string | null

  // Reference to canonical role entity (optional)
  @Column({ type: 'uuid', nullable: true })
  current_role_id!: string | null

  @ManyToOne(() => Role)
  @JoinColumn({ name: 'current_role_id' })
  role?: Role | null

  @Column('text', { nullable: true })
  current_company!: string | null

  // Reference to canonical company entity (optional)
  @Column({ type: 'uuid', nullable: true })
  current_company_id!: string | null

  @ManyToOne(() => Company)
  @JoinColumn({ name: 'current_company_id' })
  company?: Company | null

  // Persona indicates the user's current context for career status
  @Column('text', { nullable: true })
  persona!: 'student' | 'intern' | 'professional' | null

  // Flexible details based on persona
  // student: { degree?, institution?, graduation_year?, major?, gpa?, looking_for?: string[] }
  // intern: { role?, organization?, available_from?, duration_months?, stipend_expectation? }
  // professional: { total_experience_months?, employment_type_preference?, location?, remote? }
  @Column({ type: 'jsonb', nullable: true })
  persona_info!: any | null

  // Public profile link for personalization and enrichment
  @Column('text', { nullable: true })
  linkedin_url!: string | null

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at!: Date
}


