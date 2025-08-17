import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddThemeToUserProfile1715000003001 implements MigrationInterface {
  name = 'AddThemeToUserProfile1715000003001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "user_profile"
      ADD COLUMN IF NOT EXISTS "theme" text
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "user_profile"
      DROP COLUMN IF EXISTS "theme"
    `);
  }
}


