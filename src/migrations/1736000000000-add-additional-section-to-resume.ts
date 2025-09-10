import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddAdditionalSectionToResume1736000000000 implements MigrationInterface {
  name = 'AddAdditionalSectionToResume1736000000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "resume" ADD COLUMN IF NOT EXISTS "additional_section" jsonb NOT NULL DEFAULT '[]'`
    )
    // Migrate any legacy projects stored under additional_section into canonical sections array
    await queryRunner.query(`
      UPDATE "resume" r
      SET sections = (
        SELECT COALESCE(r.sections, '[]'::jsonb) || COALESCE(
          (
            SELECT jsonb_agg(jsonb_build_object('id', 'projects', 'type', 'projects', 'title', 'Projects', 'order',
                    jsonb_array_length(COALESCE(r.sections, '[]'::jsonb)), 'content', s.content))
            FROM (
              SELECT jsonb_array_elements(r.additional_section) AS sec
            ) x
            CROSS JOIN LATERAL (
              SELECT (x.sec->'content') AS content
            ) s
            WHERE (x.sec->>'type') = 'projects'
          ), '[]'::jsonb)
      )
      WHERE EXISTS (
        SELECT 1 FROM (
          SELECT jsonb_array_elements(r.additional_section) AS sec
        ) y WHERE (y.sec->>'type') = 'projects'
      )
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "resume" DROP COLUMN IF EXISTS "additional_section"`
    )
  }
}


