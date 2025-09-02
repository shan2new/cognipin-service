import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddLocationFieldsToApplication1725000000020 implements MigrationInterface {
  name = 'AddLocationFieldsToApplication1725000000020'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "application"
        ADD COLUMN IF NOT EXISTS job_location_city text NULL,
        ADD COLUMN IF NOT EXISTS job_location_country text NULL,
        ADD COLUMN IF NOT EXISTS work_location_type text NULL
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "application"
        DROP COLUMN IF EXISTS job_location_city,
        DROP COLUMN IF EXISTS job_location_country,
        DROP COLUMN IF EXISTS work_location_type
    `)
  }
}


