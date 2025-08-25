import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddResumeEntity1725000000003 implements MigrationInterface {
  name = 'AddResumeEntity1725000000003';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "resume" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "personal_info" jsonb NOT NULL,
        "summary" text,
        "experience" jsonb NOT NULL DEFAULT '[]',
        "achievements" jsonb NOT NULL DEFAULT '[]',
        "leadership" jsonb NOT NULL DEFAULT '[]',
        "education" jsonb NOT NULL DEFAULT '[]',
        "technologies" jsonb NOT NULL DEFAULT '[]',
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_resume" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_resume_created_at" ON "resume" ("created_at")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_resume_updated_at" ON "resume" ("updated_at")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_resume_updated_at"`);
    await queryRunner.query(`DROP INDEX "IDX_resume_created_at"`);
    await queryRunner.query(`DROP TABLE "resume"`);
  }
}
