import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPersonaToUserProfile1715000003003 implements MigrationInterface {
  name = 'AddPersonaToUserProfile1715000003003';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "user_profile"
      ADD COLUMN IF NOT EXISTS "persona" text
    `);
    await queryRunner.query(`
      ALTER TABLE "user_profile"
      ADD COLUMN IF NOT EXISTS "persona_info" jsonb
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "user_profile"
      DROP COLUMN IF EXISTS "persona_info"
    `);
    await queryRunner.query(`
      ALTER TABLE "user_profile"
      DROP COLUMN IF EXISTS "persona"
    `);
  }
}
