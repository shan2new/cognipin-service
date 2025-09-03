import { Column, CreateDateColumn, Entity, Index, OneToMany, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm'
import { UserCompanyTarget } from './user-company-target.entity'

@Entity({ name: 'company_group' })
@Index('idx_company_group_user', ['user_id'])
export class CompanyGroup {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  @Column({ type: 'text' })
  user_id!: string

  @Column({ type: 'text' })
  name!: string

  @Column({ type: 'int', default: 0 })
  sort_order!: number

  @OneToMany(() => UserCompanyTarget, (t) => t.group)
  targets?: Array<UserCompanyTarget>

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at!: Date
}


