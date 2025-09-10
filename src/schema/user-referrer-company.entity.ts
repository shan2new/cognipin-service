import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm'

@Entity({ name: 'user_referrer_company' })
export class UserReferrerCompany {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  @Column({ type: 'uuid' })
  user_referrer_id!: string

  @Column({ type: 'uuid' })
  company_id!: string
}


