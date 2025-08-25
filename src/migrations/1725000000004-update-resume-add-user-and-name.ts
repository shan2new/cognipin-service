import { MigrationInterface, QueryRunner } from 'typeorm'

export class UpdateResumeAddUserAndName1725000000004 implements MigrationInterface {
  name = 'UpdateResumeAddUserAndName1725000000004'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "resume"
      ADD COLUMN IF NOT EXISTS "user_id" text NOT NULL DEFAULT ''
    `)

    // Remove temporary default and enforce NOT NULL by setting from existing users later if needed
    await queryRunner.query(`
      ALTER TABLE "resume"
      ALTER COLUMN "user_id" DROP DEFAULT
    `)

    await queryRunner.query(`
      ALTER TABLE "resume"
      ADD COLUMN IF NOT EXISTS "name" text NOT NULL DEFAULT 'Untitled Resume'
    `)

    await queryRunner.query(`
      ALTER TABLE "resume"
      ADD COLUMN IF NOT EXISTS "is_default" boolean NOT NULL DEFAULT false
    `)

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_resume_user" ON "resume" ("user_id")
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_resume_user"`)
    await queryRunner.query(`ALTER TABLE "resume" DROP COLUMN IF EXISTS "is_default"`)
    await queryRunner.query(`ALTER TABLE "resume" DROP COLUMN IF EXISTS "name"`)
    await queryRunner.query(`ALTER TABLE "resume" DROP COLUMN IF EXISTS "user_id"`)
  }
}


