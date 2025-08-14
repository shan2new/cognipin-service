import { MigrationInterface, QueryRunner } from 'typeorm'

export class Init1710000000000 implements MigrationInterface {
  name = 'Init1710000000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Ensure pgcrypto extension for gen_random_uuid used in later tables
    await queryRunner.query('CREATE EXTENSION IF NOT EXISTS pgcrypto')
    await queryRunner.query(`CREATE TYPE difficulty_enum AS ENUM ('Easy','Medium','Hard')`)
    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS problems (
        id varchar PRIMARY KEY,
        name varchar NOT NULL,
        url varchar NOT NULL,
        difficulty difficulty_enum NOT NULL,
        topic varchar NOT NULL,
        subtopic varchar NOT NULL
      )`
    )

    await queryRunner.query(`CREATE TYPE problem_status_enum AS ENUM ('Not Started','Attempted','Solved')`)
    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS problem_progress (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id varchar NOT NULL,
        problem_id varchar NOT NULL REFERENCES problems(id) ON DELETE CASCADE,
        status problem_status_enum NOT NULL DEFAULT 'Not Started',
        revisit boolean NOT NULL DEFAULT false,
        personal_difficulty varchar,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT uq_user_problem UNIQUE (user_id, problem_id)
      )`
    )

    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS problem_attempts (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id varchar NOT NULL,
        problem_id varchar NOT NULL REFERENCES problems(id) ON DELETE CASCADE,
        status problem_status_enum NOT NULL,
        time_taken_minutes int,
        attempted_at timestamptz NOT NULL DEFAULT now()
      )`
    )

    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS problem_notes (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id varchar NOT NULL,
        problem_id varchar NOT NULL REFERENCES problems(id) ON DELETE CASCADE,
        content text NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )`
    )

    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_progress_user ON problem_progress(user_id)`)
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_progress_problem ON problem_progress(problem_id)`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS problem_notes')
    await queryRunner.query('DROP TABLE IF EXISTS problem_attempts')
    await queryRunner.query('DROP TABLE IF EXISTS problem_progress')
    await queryRunner.query('DROP TABLE IF EXISTS problems')
    await queryRunner.query('DROP TYPE IF EXISTS problem_status_enum')
    await queryRunner.query('DROP TYPE IF EXISTS difficulty_enum')
  }
}


