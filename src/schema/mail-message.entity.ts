import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm'
import { MailThread } from './mail-thread.entity'

@Entity({ name: 'mail_message' })
export class MailMessage {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  @Column('uuid')
  thread_id!: string

  @ManyToOne(() => MailThread)
  @JoinColumn({ name: 'thread_id' })
  thread?: MailThread

  @Column({ type: 'text' })
  @Index('idx_mail_message_gmail_id', { unique: true })
  gmail_message_id!: string

  @Column({ type: 'timestamptz' })
  internal_date!: Date

  @Column({ type: 'jsonb', nullable: true })
  headers!: any | null

  @Column({ type: 'jsonb', nullable: true })
  from!: any | null

  @Column({ type: 'jsonb', nullable: true })
  to!: any | null

  @Column({ type: 'jsonb', nullable: true })
  cc!: any | null

  @Column({ type: 'jsonb', nullable: true })
  bcc!: any | null

  @Column({ type: 'text', nullable: true })
  subject!: string | null

  @Column({ type: 'text', nullable: true })
  body_text!: string | null

  @Column({ type: 'text', nullable: true })
  body_html!: string | null

  @Column({ type: 'jsonb', nullable: true })
  label_ids!: string[] | null

  @Column({ type: 'text', nullable: true })
  mime_type!: string | null

  @Column({ type: 'text', nullable: true })
  snippet!: string | null

  @Column({ type: 'text', nullable: true })
  calendar_event_id!: string | null

  @Column({ type: 'boolean', default: false })
  has_attachments!: boolean

  @Column({ type: 'text' })
  direction!: 'inbound' | 'outbound'

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date
}


