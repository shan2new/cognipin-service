import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCurrentRoleCompanyToUserProfile1715000003002 implements MigrationInterface {
  name = 'AddCurrentRoleCompanyToUserProfile1715000003002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "user_profile"
      ADD COLUMN IF NOT EXISTS "current_role" text
    `);
    await queryRunner.query(`
      ALTER TABLE "user_profile"
      ADD COLUMN IF NOT EXISTS "current_company" text
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "user_profile"
      DROP COLUMN IF EXISTS "current_company"
    `);
    await queryRunner.query(`
      ALTER TABLE "user_profile"
      DROP COLUMN IF EXISTS "current_role"
    `);
  }
}
