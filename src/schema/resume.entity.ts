import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm'

@Entity({ name: 'resume' })
@Index('idx_resume_user', ['user_id'])
export class Resume {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  @Column({ type: 'text' })
  user_id!: string

  @Column({ type: 'text' })
  name!: string

  @Column({ type: 'boolean', default: false })
  is_default!: boolean

  // Flexible JSON sections
  @Column({ type: 'jsonb' })
  personal_info!: Record<string, any>

  @Column({ type: 'text', nullable: true })
  summary!: string | null

  @Column({ type: 'jsonb', default: () => `'[]'` })
  experience!: Array<any>

  @Column({ type: 'jsonb', default: () => `'[]'` })
  achievements!: Array<any>

  @Column({ type: 'jsonb', default: () => `'[]'` })
  leadership!: Array<any>

  @Column({ type: 'jsonb', default: () => `'[]'` })
  education!: Array<any>

  @Column({ type: 'jsonb', default: () => `'[]'` })
  technologies!: Array<any>

  // New flexible sections model and presentation settings
  @Column({ type: 'jsonb', default: () => `'[]'` })
  sections!: Array<any>

  // Additional dynamic sections not covered by canonical fields
  @Column({ type: 'jsonb', default: () => `'[]'` })
  additional_section!: Array<any>

  @Column({ type: 'text', nullable: true })
  template_id!: string | null

  @Column({ type: 'jsonb', nullable: true })
  theme!: Record<string, any> | null

  @Column({ type: 'jsonb', nullable: true })
  ats_meta!: Record<string, any> | null

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at!: Date
}


