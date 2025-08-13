import { Column, Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm'
import { Topic } from './topic.entity'

@Entity({ name: 'subtopics' })
export class Subtopic {
  @PrimaryColumn({ type: 'varchar' })
  id!: string // slug within topic, e.g., 'two-pointers'

  @Column({ type: 'varchar' })
  title!: string

  @ManyToOne(() => Topic, (t) => t.subtopics, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'topic_id' })
  topic!: Topic

  @Column({ name: 'topic_id', type: 'varchar' })
  topicId!: string
}


