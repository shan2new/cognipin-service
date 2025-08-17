import { MigrationInterface, QueryRunner } from 'typeorm';

export class ExtendCompanyEntity1715000001000 implements MigrationInterface {
  name = 'ExtendCompanyEntity1715000001000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "company" 
      ADD COLUMN "domain" text,
      ADD COLUMN "date_of_incorporation" text,
      ADD COLUMN "founded_year" text,
      ADD COLUMN "description" text,
      ADD COLUMN "industries" text[],
      ADD COLUMN "hq" jsonb,
      ADD COLUMN "employee_count" text,
      ADD COLUMN "founders" jsonb,
      ADD COLUMN "leadership" jsonb,
      ADD COLUMN "linkedin_url" text,
      ADD COLUMN "crunchbase_url" text,
      ADD COLUMN "traxcn_url" text,
      ADD COLUMN "funding_total_usd" decimal(15,2),
      ADD COLUMN "last_funding" jsonb,
      ADD COLUMN "is_public" boolean,
      ADD COLUMN "ticker" text,
      ADD COLUMN "sources" text[],
      ADD COLUMN "confidence" decimal(3,2)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "company" 
      DROP COLUMN "domain",
      DROP COLUMN "date_of_incorporation",
      DROP COLUMN "founded_year",
      DROP COLUMN "description",
      DROP COLUMN "industries",
      DROP COLUMN "hq",
      DROP COLUMN "employee_count",
      DROP COLUMN "founders",
      DROP COLUMN "leadership",
      DROP COLUMN "linkedin_url",
      DROP COLUMN "crunchbase_url",
      DROP COLUMN "traxcn_url",
      DROP COLUMN "funding_total_usd",
      DROP COLUMN "last_funding",
      DROP COLUMN "is_public",
      DROP COLUMN "ticker",
      DROP COLUMN "sources",
      DROP COLUMN "confidence"
    `);
  }
}
