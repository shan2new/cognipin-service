import { Column, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm'

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

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at!: Date
}


