import { MigrationInterface, QueryRunner } from 'typeorm'

export class ResumeSectionsAndPresentation1725000000005 implements MigrationInterface {
  name = 'ResumeSectionsAndPresentation1725000000005'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "resume" ADD COLUMN IF NOT EXISTS "sections" jsonb NOT NULL DEFAULT '[]'`)
    await queryRunner.query(`ALTER TABLE "resume" ADD COLUMN IF NOT EXISTS "template_id" text`)
    await queryRunner.query(`ALTER TABLE "resume" ADD COLUMN IF NOT EXISTS "theme" jsonb`)
    await queryRunner.query(`ALTER TABLE "resume" ADD COLUMN IF NOT EXISTS "ats_meta" jsonb`)

    // Backfill sections for existing rows from legacy columns
    await queryRunner.query(`
      UPDATE "resume" r
      SET sections = (
        SELECT jsonb_agg(s) FROM (
          SELECT 0 as order, 'summary' as type, jsonb_build_object('text', COALESCE(r.summary, '')) as content
          UNION ALL
          SELECT 1 as order, 'experience' as type, COALESCE(r.experience, '[]'::jsonb) as content
          UNION ALL
          SELECT 2 as order, 'achievements' as type, COALESCE(r.achievements, '[]'::jsonb) as content
          UNION ALL
          SELECT 3 as order, 'education' as type, COALESCE(r.education, '[]'::jsonb) as content
          UNION ALL
          SELECT 4 as order, 'skills' as type, jsonb_build_object('groups', COALESCE(r.technologies, '[]'::jsonb)) as content
        ) s
      )
      WHERE (r.sections IS NULL OR jsonb_array_length(r.sections) = 0)
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "resume" DROP COLUMN IF EXISTS "ats_meta"`)
    await queryRunner.query(`ALTER TABLE "resume" DROP COLUMN IF EXISTS "theme"`)
    await queryRunner.query(`ALTER TABLE "resume" DROP COLUMN IF EXISTS "template_id"`)
    await queryRunner.query(`ALTER TABLE "resume" DROP COLUMN IF EXISTS "sections"`)
  }
}


