import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm'

@Entity({ name: 'platform' })
export class Platform {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  @Column({ type: 'text' })
  name!: string

  @Column({ type: 'text', unique: true })
  url!: string

  @Column({ type: 'text', nullable: true })
  logo_url!: string | null

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at!: Date
}


