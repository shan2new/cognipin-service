import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm'

@Entity({ name: 'mail_account' })
export class MailAccount {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  @Column({ type: 'text' })
  @Index('idx_mail_account_user')
  user_id!: string

  @Column({ type: 'text', default: 'gmail' })
  provider!: 'gmail'

  @Column({ type: 'text' })
  email!: string

  @Column({ type: 'text', nullable: true })
  last_history_id!: string | null

  @Column({ type: 'timestamptz', nullable: true })
  last_sync_at!: Date | null

  @Column({ type: 'timestamptz', nullable: true })
  watch_expiration!: Date | null

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at!: Date
}


