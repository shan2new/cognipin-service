import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddPlatformJobId1737000000000 implements MigrationInterface {
  name = 'AddPlatformJobId1737000000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "application"
        ADD COLUMN IF NOT EXISTS platform_job_id text NULL;
    `)
    await queryRunner.query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_indexes WHERE indexname = 'uq_user_platform_job'
        ) THEN
          CREATE UNIQUE INDEX uq_user_platform_job ON "application" (user_id, platform_id, platform_job_id);
        END IF;
      END $$;
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS uq_user_platform_job;
    `)
    await queryRunner.query(`
      ALTER TABLE "application"
        DROP COLUMN IF EXISTS platform_job_id;
    `)
  }
}


