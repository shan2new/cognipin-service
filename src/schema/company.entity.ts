import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm'

@Entity({ name: 'company' })
export class Company {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  @Column({ type: 'text', unique: true })
  website_url!: string

  @Column({ type: 'text' })
  name!: string

  @Column({ type: 'text', nullable: true })
  logo_url!: string | null

  @Column({ type: 'text', nullable: true })
  domain!: string | null

  @Column({ type: 'text', nullable: true })
  date_of_incorporation!: string | null

  @Column({ type: 'text', nullable: true })
  founded_year!: string | null

  @Column({ type: 'text', nullable: true })
  description!: string | null

  @Column({ type: 'text', array: true, nullable: true })
  industries!: string[] | null

  @Column({ type: 'jsonb', nullable: true })
  hq!: { city?: string; country?: string } | null

  @Column({ type: 'text', nullable: true })
  employee_count!: string | null

  @Column({ type: 'jsonb', nullable: true })
  founders!: { name: string; role?: string }[] | null

  @Column({ type: 'jsonb', nullable: true })
  leadership!: { name: string; title: string }[] | null

  @Column({ type: 'text', nullable: true })
  linkedin_url!: string | null

  @Column({ type: 'text', nullable: true })
  crunchbase_url!: string | null

  @Column({ type: 'text', nullable: true })
  traxcn_url!: string | null

  @Column({ type: 'decimal', precision: 15, scale: 2, nullable: true })
  funding_total_usd!: number | null

  @Column({ type: 'jsonb', nullable: true })
  last_funding!: { round?: string; amountUSD?: number; date?: string } | null

  @Column({ type: 'boolean', nullable: true })
  is_public!: boolean | null

  @Column({ type: 'text', nullable: true })
  ticker!: string | null

  @Column({ type: 'text', array: true, nullable: true })
  sources!: string[] | null

  @Column({ type: 'decimal', precision: 3, scale: 2, nullable: true })
  confidence!: number | null

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at!: Date
}


