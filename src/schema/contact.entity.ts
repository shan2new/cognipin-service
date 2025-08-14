import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm'

@Entity({ name: 'contact' })
export class Contact {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  @Column({ type: 'text' })
  name!: string

  @Column({ type: 'text', nullable: true })
  title!: string | null

  @Column({ type: 'text', nullable: true })
  notes!: string | null

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date
}


