import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddLogoUrlToCompanyAndPlatform1725000000007 implements MigrationInterface {
  name = 'AddLogoUrlToCompanyAndPlatform1725000000007'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "company"
      ADD COLUMN IF NOT EXISTS "logo_url" text
    `)
    await queryRunner.query(`
      ALTER TABLE "platform"
      ADD COLUMN IF NOT EXISTS "logo_url" text
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "company"
      DROP COLUMN IF EXISTS "logo_url"
    `)
    await queryRunner.query(`
      ALTER TABLE "platform"
      DROP COLUMN IF EXISTS "logo_url"
    `)
  }
}
