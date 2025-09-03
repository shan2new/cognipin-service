import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm'
import { Company } from './company.entity'
import { CompanyGroup } from './company-group.entity'

@Entity({ name: 'user_company_target' })
@Index('uq_user_company_target', ['user_id', 'company_id'], { unique: true })
export class UserCompanyTarget {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  @Column({ type: 'text' })
  user_id!: string

  @Column({ type: 'uuid' })
  company_id!: string

  @ManyToOne(() => Company)
  @JoinColumn({ name: 'company_id' })
  company?: Company

  @Column({ type: 'uuid', nullable: true })
  group_id!: string | null

  @ManyToOne(() => CompanyGroup, (g) => g.targets, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'group_id' })
  group?: CompanyGroup | null

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at!: Date
}


