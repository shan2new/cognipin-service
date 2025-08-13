import 'dotenv/config'
import { DataSourceOptions } from 'typeorm'
import { Problem } from './schema/problem.entity'
import { ProblemProgress } from './schema/problem-progress.entity'
import { ProblemAttempt } from './schema/problem-attempt.entity'
import { ProblemNote } from './schema/problem-note.entity'
import { Topic } from './schema/topic.entity'
import { Subtopic } from './schema/subtopic.entity'
import { Section, SectionTopic } from './schema/section.entity'

const ormConfig: DataSourceOptions = {
  type: 'postgres',
  url: process.env.DATABASE_URL,
  entities: [Problem, ProblemProgress, ProblemAttempt, ProblemNote, Topic, Subtopic, Section, SectionTopic],
  synchronize: false,
  migrations: ['src/migrations/*.ts'],
  migrationsTableName: 'typeorm_migrations',
  logging: false,
}

export default ormConfig



