import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddCompanyGroupsAndTargets1726000000000 implements MigrationInterface {
  name = 'AddCompanyGroupsAndTargets1726000000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "company_group" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "user_id" TEXT NOT NULL,
        "name" TEXT NOT NULL,
        "sort_order" INT NOT NULL DEFAULT 0,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `)
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_company_group_user" ON "company_group" ("user_id")
    `)

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "user_company_target" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "user_id" TEXT NOT NULL,
        "company_id" UUID NOT NULL REFERENCES company(id) ON DELETE CASCADE,
        "group_id" UUID NULL REFERENCES company_group(id) ON DELETE SET NULL,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `)
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "uq_user_company_target" ON "user_company_target" ("user_id", "company_id")
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "uq_user_company_target"`)
    await queryRunner.query(`DROP TABLE IF EXISTS "user_company_target"`)
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_company_group_user"`)
    await queryRunner.query(`DROP TABLE IF EXISTS "company_group"`)
  }
}


