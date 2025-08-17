import { MigrationInterface, QueryRunner } from 'typeorm';

export class MakeJobUrlNullable1715000003000 implements MigrationInterface {
  name = 'MakeJobUrlNullable1715000003000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "application"
      ALTER COLUMN "job_url" DROP NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "application"
      ALTER COLUMN "job_url" SET NOT NULL
    `);
  }
}


