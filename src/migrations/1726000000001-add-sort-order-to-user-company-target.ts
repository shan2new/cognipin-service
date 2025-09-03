import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddSortOrderToUserCompanyTarget1726000000001 implements MigrationInterface {
  name = 'AddSortOrderToUserCompanyTarget1726000000001'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "user_company_target" ADD COLUMN IF NOT EXISTS "sort_order" INT NOT NULL DEFAULT 0
    `)
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_user_company_target_group" ON "user_company_target" ("group_id", "sort_order")
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_user_company_target_group"`)
    await queryRunner.query(`ALTER TABLE "user_company_target" DROP COLUMN IF EXISTS "sort_order"`)
  }
}


