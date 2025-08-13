import { MigrationInterface, QueryRunner } from 'typeorm'

export class CompoundIndexes1710000002000 implements MigrationInterface {
  name = 'CompoundIndexes1710000002000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    // These indexes match our common filter/join patterns:
    // - problems filtered by topic and (optionally) difficulty, ordered by topic/subtopic
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_problems_topic_subtopic ON problems(topic_id, subtopic_id)`)
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_problems_difficulty_topic ON problems(difficulty, topic_id)`)

    // - progress lookups and counts by (user_id, status), plus join to problems by problem_id
    //   uq_user_problem already backs an index on (user_id, problem_id). Add a status-leading variant for counts.
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_progress_user_status ON problem_progress(user_id, status)`)
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_progress_user_status_problem ON problem_progress(user_id, status, problem_id)`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_progress_user_status_problem`)
    await queryRunner.query(`DROP INDEX IF EXISTS idx_progress_user_status`)
    await queryRunner.query(`DROP INDEX IF EXISTS idx_problems_difficulty_topic`)
    await queryRunner.query(`DROP INDEX IF EXISTS idx_problems_topic_subtopic`)
  }
}


