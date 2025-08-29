import { Column, CreateDateColumn, Entity, Index, ManyToOne, JoinColumn, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm'
import { MailAccount } from './mail-account.entity'

@Entity({ name: 'mail_thread' })
export class MailThread {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  @Column('uuid')
  account_id!: string

  @ManyToOne(() => MailAccount)
  @JoinColumn({ name: 'account_id' })
  account?: MailAccount

  @Column({ type: 'text' })
  @Index('idx_mail_thread_gmail_id', { unique: true })
  gmail_thread_id!: string

  @Column({ type: 'text', nullable: true })
  subject!: string | null

  @Column({ type: 'text', nullable: true })
  snippet!: string | null

  @Column({ type: 'jsonb', nullable: true })
  preview_from!: any | null

  @Column({ type: 'jsonb', nullable: true })
  preview_to!: any | null

  @Column({ type: 'timestamptz' })
  latest_at!: Date

  // Aggregated Gmail metadata for quick queries/filters
  @Column({ type: 'jsonb', nullable: true })
  label_ids!: string[] | null

  @Column({ type: 'integer', default: 0 })
  message_count!: number

  @Column({ type: 'integer', default: 0 })
  unread_count!: number

  @Column({ type: 'text', nullable: true })
  gmail_history_id!: string | null

  @Column({ type: 'uuid', nullable: true })
  last_message_id!: string | null

  @Column({ type: 'uuid', nullable: true })
  application_id!: string | null

  @Column({ type: 'text', nullable: true })
  assigned_by!: string | null

  @Column({ type: 'timestamptz', nullable: true })
  assigned_at!: Date | null

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at!: Date
}


