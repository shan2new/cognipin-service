import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddLinkedinUrlToUserProfile1725000000006 implements MigrationInterface {
  name = 'AddLinkedinUrlToUserProfile1725000000006'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "user_profile"
      ADD COLUMN IF NOT EXISTS "linkedin_url" text
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "user_profile"
      DROP COLUMN IF EXISTS "linkedin_url"
    `)
  }
}


