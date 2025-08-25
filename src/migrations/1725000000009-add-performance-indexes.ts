import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddPerformanceIndexes1725000000009 implements MigrationInterface {
  name = 'AddPerformanceIndexes1725000000009'

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Ensure pg_trgm for trigram indexes used by ILIKE searches
    await queryRunner.query('CREATE EXTENSION IF NOT EXISTS pg_trgm')

    // application: common filters and ordering
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_application_user" ON "application" ("user_id")
    `)
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_application_user_last_activity_desc" ON "application" ("user_id", "last_activity_at" DESC)
    `)

    // application_note: fetch by application ordered by created_at desc
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_application_note_app_created_desc" ON "application_note" ("application_id", "created_at" DESC)
    `)

    // application_contact: lookups by contact_id
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_application_contact_contact" ON "application_contact" ("contact_id")
    `)

    // contact_channel: lookups by contact_id
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_contact_channel_contact" ON "contact_channel" ("contact_id")
    `)

    // role: ILIKE searches on title and normalized_title
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_role_title_trgm" ON "role" USING GIN ("title" gin_trgm_ops)
    `)
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_role_normalized_title_trgm" ON "role" USING GIN ("normalized_title" gin_trgm_ops)
    `)

    // company: ILIKE searches on name and domain
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_company_name_trgm" ON "company" USING GIN ("name" gin_trgm_ops)
    `)
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_company_domain_trgm" ON "company" USING GIN ("domain" gin_trgm_ops)
    `)
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_company_website_url_trgm" ON "company" USING GIN ("website_url" gin_trgm_ops)
    `)
    // company: speed up list ordering by updated_at DESC with LIMIT
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_company_updated_desc" ON "company" ("updated_at" DESC)
    `)

    // platform: ILIKE searches on name and url
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_platform_name_trgm" ON "platform" USING GIN ("name" gin_trgm_ops)
    `)
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_platform_url_trgm" ON "platform" USING GIN ("url" gin_trgm_ops)
    `)
    // platform: list ordering by updated_at DESC with LIMIT
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_platform_updated_desc" ON "platform" ("updated_at" DESC)
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop created indexes (keep extensions)
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_platform_updated_desc"`)
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_platform_url_trgm"`)
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_platform_name_trgm"`)
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_company_updated_desc"`)
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_company_website_url_trgm"`)
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_company_domain_trgm"`)
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_company_name_trgm"`)
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_role_normalized_title_trgm"`)
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_role_title_trgm"`)
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_contact_channel_contact"`)
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_application_contact_contact"`)
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_application_note_app_created_desc"`)
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_application_user_last_activity_desc"`)
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_application_user"`)
  }
}
