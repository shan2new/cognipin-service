import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm'
import { RoleGroup } from './role-group.entity'

@Entity({ name: 'role' })
export class Role {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  // Canonical title e.g., "Senior Software Engineer"
  @Column({ type: 'text' })
  title!: string

  // Normalized key for dedupe/search; lowercased/trimmed
  @Index('uq_role_normalized_title', { unique: true })
  @Column({ type: 'text' })
  normalized_title!: string

  // Optional synonyms for better matching
  @Column({ type: 'text', array: true, nullable: true })
  synonyms!: string[] | null

  @Column({ type: 'uuid', nullable: true })
  group_id!: string | null

  @ManyToOne(() => RoleGroup, (g) => g.roles, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'group_id' })
  group?: RoleGroup | null

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at!: Date
}
