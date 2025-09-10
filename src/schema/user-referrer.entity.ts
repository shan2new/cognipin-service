import { CreateDateColumn, Entity, PrimaryGeneratedColumn, Column } from 'typeorm'

@Entity({ name: 'user_referrer' })
export class UserReferrer {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  @Column({ type: 'text' })
  user_id!: string

  @Column({ type: 'uuid' })
  contact_id!: string

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date
}


