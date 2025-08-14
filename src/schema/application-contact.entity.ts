import { Column, Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm'
import { Contact } from './contact.entity'

export type ApplicationContactRole = 'recruiter' | 'referrer' | 'hiring_manager' | 'interviewer' | 'other'

@Entity({ name: 'application_contact' })
export class ApplicationContact {
  @PrimaryColumn('uuid')
  application_id!: string

  @PrimaryColumn('uuid')
  contact_id!: string

  @ManyToOne(() => Contact)
  @JoinColumn({ name: 'contact_id' })
  contact?: Contact

  @Column({ type: 'enum', enumName: 'application_contact_role', enum: ['recruiter', 'referrer', 'hiring_manager', 'interviewer', 'other'] })
  role!: ApplicationContactRole

  @Column({ type: 'boolean', default: false })
  is_primary!: boolean
}


