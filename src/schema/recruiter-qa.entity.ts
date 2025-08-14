import { Column, Entity, PrimaryGeneratedColumn, Unique, UpdateDateColumn } from 'typeorm'

export type RecruiterQAKey =
  | 'current_ctc'
  | 'expected_ctc'
  | 'notice_period'
  | 'reason_leaving_current'
  | 'past_leaving_reasons'

@Entity({ name: 'recruiter_qa' })
@Unique('uq_recruiter_qa_user_key', ['user_id', 'key'])
export class RecruiterQA {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  @Column('text')
  user_id!: string

  @Column({ type: 'enum', enumName: 'recruiter_qa_key', enum: [
    'current_ctc', 'expected_ctc', 'notice_period', 'reason_leaving_current', 'past_leaving_reasons'] })
  key!: RecruiterQAKey

  @Column('text')
  answer!: string

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at!: Date
}


