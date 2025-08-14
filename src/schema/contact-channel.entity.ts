import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm'
import { Contact } from './contact.entity'

export type ContactChannelMedium = 'email' | 'linkedin' | 'phone' | 'whatsapp' | 'other'

@Entity({ name: 'contact_channel' })
export class ContactChannel {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  @Column('uuid')
  contact_id!: string

  @ManyToOne(() => Contact)
  @JoinColumn({ name: 'contact_id' })
  contact?: Contact

  @Column({ type: 'enum', enumName: 'contact_channel_medium', enum: ['email', 'linkedin', 'phone', 'whatsapp', 'other'] })
  medium!: ContactChannelMedium

  @Column({ type: 'text' })
  channel_value!: string
}


