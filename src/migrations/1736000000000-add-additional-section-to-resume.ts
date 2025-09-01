import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddAdditionalSectionToResume1736000000000 implements MigrationInterface {
  name = 'AddAdditionalSectionToResume1736000000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "resume" ADD COLUMN IF NOT EXISTS "additional_section" jsonb NOT NULL DEFAULT '[]'`
    )
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "resume" DROP COLUMN IF EXISTS "additional_section"`
    )
  }
}


