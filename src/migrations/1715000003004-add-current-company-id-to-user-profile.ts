import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCurrentCompanyIdToUserProfile1715000003004 implements MigrationInterface {
  name = 'AddCurrentCompanyIdToUserProfile1715000003004';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "user_profile"
      ADD COLUMN IF NOT EXISTS "current_company_id" uuid
    `);
    // Add FK constraint to company(id)
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'fk_user_profile_current_company_id'
        ) THEN
          ALTER TABLE "user_profile"
          ADD CONSTRAINT "fk_user_profile_current_company_id"
          FOREIGN KEY ("current_company_id") REFERENCES "company"(id) ON DELETE SET NULL;
        END IF;
      END$$;
    `);
    // Helpful index for lookups by current_company_id
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_user_profile_current_company_id ON "user_profile" ("current_company_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS idx_user_profile_current_company_id
    `);
    await queryRunner.query(`
      ALTER TABLE "user_profile" DROP CONSTRAINT IF EXISTS "fk_user_profile_current_company_id"
    `);
    await queryRunner.query(`
      ALTER TABLE "user_profile" DROP COLUMN IF EXISTS "current_company_id"
    `);
  }
}
