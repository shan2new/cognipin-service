import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm'
import { MailMessage } from './mail-message.entity'

@Entity({ name: 'mail_attachment' })
export class MailAttachment {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  @Column('uuid')
  message_id!: string

  @ManyToOne(() => MailMessage)
  @JoinColumn({ name: 'message_id' })
  message?: MailMessage

  @Column({ type: 'text' })
  filename!: string

  @Column({ type: 'text', nullable: true })
  mime_type!: string | null

  @Column({ type: 'integer', nullable: true })
  size!: number | null

  @Column({ type: 'text' })
  storage_key!: string

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date
}


