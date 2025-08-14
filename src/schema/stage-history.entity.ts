import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm'
import { ApplicationStage } from './application.entity'

export type StageHistoryBy = 'system' | 'user'

@Entity({ name: 'stage_history' })
export class StageHistory {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  @Column('uuid')
  application_id!: string

  @Column({ type: 'enum', enumName: 'application_stage' })
  from_stage!: ApplicationStage

  @Column({ type: 'enum', enumName: 'application_stage' })
  to_stage!: ApplicationStage

  @CreateDateColumn({ type: 'timestamptz' })
  changed_at!: Date

  @Column({ type: 'text', nullable: true })
  reason!: string | null

  @Column({ type: 'enum', enumName: 'stage_history_by', enum: ['system', 'user'] })
  by!: StageHistoryBy
}


