import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddMorePerformanceIndexes1725000000010 implements MigrationInterface {
  name = 'AddMorePerformanceIndexes1725000000010'

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Safety: ensure pg_trgm exists for trigram indexes
    await queryRunner.query('CREATE EXTENSION IF NOT EXISTS pg_trgm')

    // Missed from previous run: company website_url trigram, and updated_at DESC for company/platform
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_company_website_url_trgm" ON "company" USING GIN ("website_url" gin_trgm_ops)
    `)
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_company_updated_desc" ON "company" ("updated_at" DESC)
    `)
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_platform_updated_desc" ON "platform" ("updated_at" DESC)
    `)

    // GET platforms: list ordered by name ASC, add btree for order-by optimization
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_platform_name" ON "platform" ("name")
    `)

    // GET applications: common combined filters
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_application_user_milestone_last_activity_desc" ON "application" ("user_id", "milestone", "last_activity_at" DESC)
    `)
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_application_user_platform_last_activity_desc" ON "application" ("user_id", "platform_id", "last_activity_at" DESC)
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_application_user_platform_last_activity_desc"`)
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_application_user_milestone_last_activity_desc"`)
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_platform_name"`)
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_platform_updated_desc"`)
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_company_updated_desc"`)
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_company_website_url_trgm"`)
  }
}
