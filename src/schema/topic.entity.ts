import { Column, Entity, OneToMany, PrimaryColumn } from 'typeorm'
import { Subtopic } from './subtopic.entity'

@Entity({ name: 'topics' })
export class Topic {
  @PrimaryColumn({ type: 'varchar' })
  id!: string // slug, e.g., 'arrays-and-strings'

  @Column({ type: 'varchar', unique: true })
  title!: string

  @OneToMany(() => Subtopic, (s) => s.topic)
  subtopics!: Subtopic[]
}


