import { Column, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn } from 'typeorm'
import { Topic } from './topic.entity'

@Entity({ name: 'sections' })
export class Section {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  @Column({ type: 'varchar' })
  title!: string

  @Column({ type: 'int' })
  order!: number
}

@Entity({ name: 'section_topics' })
export class SectionTopic {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  @ManyToOne(() => Section, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'section_id' })
  section!: Section

  @Column({ name: 'section_id', type: 'uuid' })
  sectionId!: string

  @ManyToOne(() => Topic, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'topic_id' })
  topic!: Topic

  @Column({ name: 'topic_id', type: 'varchar' })
  topicId!: string

  @Column({ type: 'int' })
  order!: number
}


