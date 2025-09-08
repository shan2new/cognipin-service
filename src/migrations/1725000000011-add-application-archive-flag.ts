import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddApplicationArchiveFlag1725000000011 implements MigrationInterface {
  name = 'AddApplicationArchiveFlag1725000000011'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "application" ADD COLUMN IF NOT EXISTS "is_archived" boolean NULL`)
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_application_user_archived_last_activity_desc" ON "application" ("user_id", "is_archived", "last_activity_at" DESC)`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_application_user_archived_last_activity_desc"`)
    await queryRunner.query(`ALTER TABLE "application" DROP COLUMN IF EXISTS "is_archived"`)
  }
}


