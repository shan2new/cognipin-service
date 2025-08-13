import { Column, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryColumn } from 'typeorm'
import { ProblemProgress } from './problem-progress.entity'
import { Topic } from './topic.entity'
import { Subtopic } from './subtopic.entity'

export type Difficulty = 'Easy' | 'Medium' | 'Hard'

@Entity({ name: 'problems' })
export class Problem {
  @PrimaryColumn({ type: 'varchar' })
  id!: string

  @Column({ type: 'varchar' })
  name!: string

  @Column({ type: 'varchar' })
  url!: string

  @Column({ type: 'enum', enum: ['Easy', 'Medium', 'Hard'] })
  difficulty!: Difficulty

  @ManyToOne(() => Topic, { eager: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'topic_id' })
  topic!: Topic

  @Column({ name: 'topic_id', type: 'varchar' })
  topicId!: string

  @ManyToOne(() => Subtopic, { eager: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'subtopic_id' })
  subtopic!: Subtopic

  @Column({ name: 'subtopic_id', type: 'varchar' })
  subtopicId!: string

  @OneToMany(() => ProblemProgress, (pp: ProblemProgress) => pp.problem)
  progresses!: ProblemProgress[]
}


