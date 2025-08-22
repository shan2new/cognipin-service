import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddInterviewingStage1725000000001 implements MigrationInterface {
  name = 'AddInterviewingStage1725000000001'

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add 'interviewing' to application_stage enum
    await queryRunner.query(`
      ALTER TYPE "application_stage" ADD VALUE 'interviewing';
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Cannot remove enum values in PostgreSQL, would need to recreate the enum
    // For now, leave the value in place
    console.log('Cannot remove enum value in PostgreSQL. Manual intervention required.')
  }
}
