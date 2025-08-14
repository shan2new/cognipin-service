import { Column, Entity, JoinColumn, OneToOne, PrimaryColumn } from 'typeorm'
import { Application } from './application.entity'

@Entity({ name: 'application_compensation' })
export class ApplicationCompensation {
  @PrimaryColumn('uuid')
  application_id!: string

  @OneToOne(() => Application)
  @JoinColumn({ name: 'application_id' })
  application?: Application

  @Column({ type: 'decimal', precision: 6, scale: 2, nullable: true })
  fixed_min_lpa!: string | null

  @Column({ type: 'decimal', precision: 6, scale: 2, nullable: true })
  fixed_max_lpa!: string | null

  @Column({ type: 'decimal', precision: 6, scale: 2, nullable: true })
  var_min_lpa!: string | null

  @Column({ type: 'decimal', precision: 6, scale: 2, nullable: true })
  var_max_lpa!: string | null

  @Column({ type: 'text', nullable: true })
  tentative_ctc_note!: string | null
}


