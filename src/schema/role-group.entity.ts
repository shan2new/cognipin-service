import { Column, CreateDateColumn, Entity, OneToMany, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm'
import { Role } from './role.entity'

@Entity({ name: 'role_group' })
export class RoleGroup {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  // Stable key used for dedupe/canonicalization (lowercase, hyphenated, etc.)
  @Column({ type: 'text', unique: true })
  group_key!: string

  // Human-friendly name for the group (e.g., "Software Engineering")
  @Column({ type: 'text' })
  display_name!: string

  @OneToMany(() => Role, (role: Role) => role.group)
  roles?: Role[]

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at!: Date
}
