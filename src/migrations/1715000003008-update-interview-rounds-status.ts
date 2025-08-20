import { MigrationInterface, QueryRunner } from 'typeorm'

export class UpdateInterviewRoundsStatus1715000003008 implements MigrationInterface {
  name = 'UpdateInterviewRoundsStatus1715000003008'

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create new enum type for interview round status
    await queryRunner.query(`
      CREATE TYPE "interview_round_status" AS ENUM(
        'unscheduled', 
        'scheduled', 
        'rescheduled', 
        'completed', 
        'rejected', 
        'withdrawn'
      )
    `)

    // Add new columns
    await queryRunner.query(`
      ALTER TABLE "interview_round" 
      ADD COLUMN "custom_name" text
    `)

    await queryRunner.query(`
      ALTER TABLE "interview_round" 
      ADD COLUMN "status" "interview_round_status" NOT NULL DEFAULT 'unscheduled'
    `)

    await queryRunner.query(`
      ALTER TABLE "interview_round" 
      ADD COLUMN "rejection_reason" text
    `)

    // Make scheduled_at nullable (it was previously required)
    await queryRunner.query(`
      ALTER TABLE "interview_round" 
      ALTER COLUMN "scheduled_at" DROP NOT NULL
    `)

    // Add default value for mode column
    await queryRunner.query(`
      ALTER TABLE "interview_round" 
      ALTER COLUMN "mode" SET DEFAULT 'online'
    `)

    // Update existing records to have proper status based on their current state
    await queryRunner.query(`
      UPDATE "interview_round" 
      SET "status" = CASE 
        WHEN "completed_at" IS NOT NULL THEN 'completed'
        WHEN "result" = 'rejected' THEN 'rejected'
        WHEN "scheduled_at" IS NOT NULL AND "rescheduled_count" > 0 THEN 'rescheduled'
        WHEN "scheduled_at" IS NOT NULL THEN 'scheduled'
        ELSE 'unscheduled'
      END
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remove default from mode column
    await queryRunner.query(`
      ALTER TABLE "interview_round" 
      ALTER COLUMN "mode" DROP DEFAULT
    `)

    // Make scheduled_at required again
    await queryRunner.query(`
      ALTER TABLE "interview_round" 
      ALTER COLUMN "scheduled_at" SET NOT NULL
    `)

    // Remove new columns
    await queryRunner.query(`
      ALTER TABLE "interview_round" 
      DROP COLUMN "rejection_reason"
    `)

    await queryRunner.query(`
      ALTER TABLE "interview_round" 
      DROP COLUMN "status"
    `)

    await queryRunner.query(`
      ALTER TABLE "interview_round" 
      DROP COLUMN "custom_name"
    `)

    // Drop enum type
    await queryRunner.query(`
      DROP TYPE "interview_round_status"
    `)
  }
}
