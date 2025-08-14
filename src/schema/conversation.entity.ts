import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm'
import { Contact } from './contact.entity'

export type ConversationDirection = 'outbound' | 'inbound'
export type ContactChannelMedium = 'email' | 'linkedin' | 'phone' | 'whatsapp' | 'other'

@Entity({ name: 'conversation' })
export class Conversation {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  @Column('uuid')
  application_id!: string

  @Column('uuid', { nullable: true })
  contact_id!: string | null

  @ManyToOne(() => Contact)
  @JoinColumn({ name: 'contact_id' })
  contact?: Contact | null

  @Column({ type: 'enum', enumName: 'contact_channel_medium', enum: ['email', 'linkedin', 'phone', 'whatsapp', 'other'] })
  medium!: ContactChannelMedium

  @Column({ type: 'enum', enumName: 'conversation_direction', enum: ['outbound', 'inbound'] })
  direction!: ConversationDirection

  @Column({ type: 'text' })
  text!: string

  @Column({ type: 'timestamptz' })
  occurred_at!: Date
}


