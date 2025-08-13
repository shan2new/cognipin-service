import { MigrationInterface, QueryRunner } from 'typeorm'

export class NormalizeTopics1710000001000 implements MigrationInterface {
  name = 'NormalizeTopics1710000001000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create topics and subtopics
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS topics (
        id varchar PRIMARY KEY,
        title varchar UNIQUE NOT NULL
      )
    `)
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS subtopics (
        id varchar PRIMARY KEY,
        title varchar NOT NULL,
        topic_id varchar NOT NULL REFERENCES topics(id) ON DELETE CASCADE
      )
    `)

    // Create sections and section_topics
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS sections (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        title varchar NOT NULL,
        "order" int NOT NULL
      )
    `)
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS section_topics (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        section_id uuid NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
        topic_id varchar NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
        "order" int NOT NULL
      )
    `)

    // Add FKs to problems
    await queryRunner.query(`ALTER TABLE problems ADD COLUMN IF NOT EXISTS topic_id varchar`)
    await queryRunner.query(`ALTER TABLE problems ADD COLUMN IF NOT EXISTS subtopic_id varchar`)

    // Backfill topics/subtopics from existing string columns
    // Insert distinct topics
    await queryRunner.query(`
      INSERT INTO topics (id, title)
      SELECT LOWER(REPLACE(REPLACE(topic,' & ',' and '),' ','-')) as id, topic as title
      FROM (
        SELECT DISTINCT topic FROM problems
      ) t
      ON CONFLICT (title) DO NOTHING
    `)
    // Insert distinct subtopics with references
    await queryRunner.query(`
      INSERT INTO subtopics (id, title, topic_id)
      SELECT 
        LOWER(REPLACE(REPLACE(p.subtopic,' & ',' and '),' ','-')) as id,
        p.subtopic as title,
        LOWER(REPLACE(REPLACE(p.topic,' & ',' and '),' ','-')) as topic_id
      FROM (
        SELECT DISTINCT topic, subtopic FROM problems
      ) p
      ON CONFLICT (id) DO NOTHING
    `)

    // Update problems to set FKs
    await queryRunner.query(`
      UPDATE problems pr
      SET topic_id = LOWER(REPLACE(REPLACE(pr.topic,' & ',' and '),' ','-')),
          subtopic_id = LOWER(REPLACE(REPLACE(pr.subtopic,' & ',' and '),' ','-'))
    `)

    // Set NOT NULL after backfill
    await queryRunner.query(`ALTER TABLE problems ALTER COLUMN topic_id SET NOT NULL`)
    await queryRunner.query(`ALTER TABLE problems ALTER COLUMN subtopic_id SET NOT NULL`)
    // Performance indexes for filtering/sorting
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_problems_topic ON problems(topic_id)`)
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_problems_subtopic ON problems(subtopic_id)`)
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_problems_difficulty ON problems(difficulty)`)
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_topics_title ON topics(title)`)
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_subtopics_title ON subtopics(title)`)

    // Optional: keep legacy text columns for now or drop; we'll drop to normalize
    await queryRunner.query(`ALTER TABLE problems DROP COLUMN topic`)
    await queryRunner.query(`ALTER TABLE problems DROP COLUMN subtopic`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Re-add legacy columns
    await queryRunner.query(`ALTER TABLE problems ADD COLUMN topic varchar`)
    await queryRunner.query(`ALTER TABLE problems ADD COLUMN subtopic varchar`)
    await queryRunner.query(`
      UPDATE problems pr
      SET topic = t.title
      FROM topics t
      WHERE pr.topic_id = t.id
    `)
    await queryRunner.query(`
      UPDATE problems pr
      SET subtopic = s.title
      FROM subtopics s
      WHERE pr.subtopic_id = s.id
    `)
    await queryRunner.query(`ALTER TABLE problems DROP COLUMN topic_id`)
    await queryRunner.query(`ALTER TABLE problems DROP COLUMN subtopic_id`)
    await queryRunner.query(`DROP TABLE IF EXISTS section_topics`)
    await queryRunner.query(`DROP TABLE IF EXISTS sections`)
    await queryRunner.query(`DROP TABLE IF EXISTS subtopics`)
    await queryRunner.query(`DROP TABLE IF EXISTS topics`)
  }
}


