import { Column, Entity, JoinColumn, OneToOne, PrimaryColumn } from 'typeorm'
import { Application } from './application.entity'

@Entity({ name: 'application_qa_snapshot' })
export class ApplicationQASnapshot {
  @PrimaryColumn('uuid')
  application_id!: string

  @OneToOne(() => Application)
  @JoinColumn({ name: 'application_id' })
  application?: Application

  @Column({ type: 'text', nullable: true })
  current_ctc_text!: string | null

  @Column({ type: 'text', nullable: true })
  expected_ctc_text!: string | null

  @Column({ type: 'text', nullable: true })
  notice_period_text!: string | null

  @Column({ type: 'text', nullable: true })
  reason_leaving_current_text!: string | null

  @Column({ type: 'text', nullable: true })
  past_leaving_reasons_text!: string | null
}


