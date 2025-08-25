import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddRoleGroupAndRole1725000000008 implements MigrationInterface {
  name = 'AddRoleGroupAndRole1725000000008'

  public async up(queryRunner: QueryRunner): Promise<void> {
    // role_group table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "role_group" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "group_key" TEXT UNIQUE NOT NULL,
        "display_name" TEXT NOT NULL,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `)

    // role table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "role" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "title" TEXT NOT NULL,
        "normalized_title" TEXT NOT NULL,
        "synonyms" TEXT[] NULL,
        "group_id" UUID NULL REFERENCES role_group(id) ON DELETE SET NULL,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `)

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "uq_role_normalized_title" ON "role" ("normalized_title")
    `)

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_role_group_id" ON "role" ("group_id")
    `)

    // user_profile -> current_role_id
    await queryRunner.query(`
      ALTER TABLE "user_profile"
      ADD COLUMN IF NOT EXISTS "current_role_id" UUID NULL REFERENCES role(id) ON DELETE SET NULL
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "user_profile"
      DROP COLUMN IF EXISTS "current_role_id"
    `)

    await queryRunner.query(`
      DROP INDEX IF EXISTS "idx_role_group_id"
    `)

    await queryRunner.query(`
      DROP INDEX IF EXISTS "uq_role_normalized_title"
    `)

    await queryRunner.query(`
      DROP TABLE IF EXISTS "role"
    `)

    await queryRunner.query(`
      DROP TABLE IF EXISTS "role_group"
    `)
  }
}
