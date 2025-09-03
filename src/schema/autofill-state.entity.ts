import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm'

@Entity({ name: 'user_autofill_state' })
@Index('idx_user_autofill_state_user', ['user_id'], { unique: true })
export class UserAutofillState {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  @Column({ type: 'text' })
  user_id!: string

  // Store the entire UI state as flexible JSON
  @Column({ type: 'jsonb' })
  state!: Record<string, any>

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at!: Date
}


