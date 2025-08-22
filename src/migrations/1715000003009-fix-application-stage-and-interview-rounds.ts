import { MigrationInterface, QueryRunner } from 'typeorm'

/**
 * Aligns DB with current entity/usage:
 * - Expands application_stage enum to include new values (hr_shortlisted, hm_shortlisted, applied, interview, offered)
 *   while preserving existing values from the initial migration.
 * - Updates all columns using application_stage (application.stage, stage_history.from_stage, stage_history.to_stage).
 * - Ensures interview_round has columns custom_name, status, rejection_reason and the enum interview_round_status.
 */
export class FixApplicationStageAndInterviewRounds1715000003009 implements MigrationInterface {
  name = 'FixApplicationStageAndInterviewRounds1715000003009'

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1) Ensure interview_round enhancements exist (idempotent)
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'interview_round_status') THEN
          CREATE TYPE "interview_round_status" AS ENUM(
            'unscheduled',
            'scheduled',
            'rescheduled',
            'completed',
            'rejected',
            'withdrawn'
          );
        END IF;
      END$$;
    `)

    await queryRunner.query(`
      ALTER TABLE "interview_round" 
      ADD COLUMN IF NOT EXISTS "custom_name" text
    `)

    await queryRunner.query(`
      ALTER TABLE "interview_round" 
      ADD COLUMN IF NOT EXISTS "status" "interview_round_status" NOT NULL DEFAULT 'unscheduled'
    `)

    await queryRunner.query(`
      ALTER TABLE "interview_round" 
      ADD COLUMN IF NOT EXISTS "rejection_reason" text
    `)

    await queryRunner.query(`
      ALTER TABLE "interview_round" 
      ALTER COLUMN "scheduled_at" DROP NOT NULL
    `)

    await queryRunner.query(`
      ALTER TABLE "interview_round" 
      ALTER COLUMN "mode" SET DEFAULT 'online'
    `)

    // 2) Update application_stage enum to a superset of values used by code/entities
    // Create a new enum type with the complete set of values
    await queryRunner.query(`
      CREATE TYPE "application_stage_new" AS ENUM (
        'recruiter_outreach',
        'applied_self',
        'applied_referral',
        'hr_shortlisted',
        'hm_shortlisted',
        'interview_shortlist',
        'interview_scheduled',
        'interview_rescheduled',
        'interview_completed',
        'interview_passed',
        'interview_rejected',
        'offer',
        'rejected',
        'on_hold',
        'withdrawn',
        'accepted',
        -- additional coarse states currently used by UI
        'applied',
        'interview',
        'offered'
      )
    `)

    // Alter columns to use the new enum type
    await queryRunner.query(`
      ALTER TABLE "application"
      ALTER COLUMN "stage" TYPE "application_stage_new" USING "stage"::text::"application_stage_new"
    `)

    await queryRunner.query(`
      ALTER TABLE "stage_history"
      ALTER COLUMN "from_stage" TYPE "application_stage_new" USING "from_stage"::text::"application_stage_new",
      ALTER COLUMN "to_stage"   TYPE "application_stage_new" USING "to_stage"::text::"application_stage_new"
    `)

    // Drop old enum and rename new to original name
    await queryRunner.query(`
      DROP TYPE "application_stage"
    `)

    await queryRunner.query(`
      ALTER TYPE "application_stage_new" RENAME TO "application_stage"
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Revert interview_round changes where possible
    await queryRunner.query(`
      ALTER TABLE "interview_round" 
      ALTER COLUMN "mode" DROP DEFAULT
    `)

    // Note: We won't forcibly make scheduled_at NOT NULL in down to avoid failures if data violates it.
    await queryRunner.query(`
      ALTER TABLE "interview_round" 
      DROP COLUMN IF EXISTS "rejection_reason"
    `)

    await queryRunner.query(`
      ALTER TABLE "interview_round" 
      DROP COLUMN IF EXISTS "status"
    `)

    await queryRunner.query(`
      ALTER TABLE "interview_round" 
      DROP COLUMN IF EXISTS "custom_name"
    `)

    // Restore original application_stage enum definition from initial migration
    await queryRunner.query(`
      CREATE TYPE "application_stage_old" AS ENUM (
        'recruiter_outreach',
        'applied_self',
        'applied_referral',
        'recruiter_discussion',
        'pending_shortlist',
        'interview_shortlist',
        'interview_scheduled',
        'interview_rescheduled',
        'interview_completed',
        'interview_passed',
        'interview_rejected',
        'offer',
        'rejected',
        'on_hold',
        'withdrawn',
        'accepted'
      )
    `)

    await queryRunner.query(`
      ALTER TABLE "stage_history"
      ALTER COLUMN "from_stage" TYPE "application_stage_old" USING "from_stage"::text::"application_stage_old",
      ALTER COLUMN "to_stage"   TYPE "application_stage_old" USING "to_stage"::text::"application_stage_old"
    `)

    await queryRunner.query(`
      ALTER TABLE "application"
      ALTER COLUMN "stage" TYPE "application_stage_old" USING "stage"::text::"application_stage_old"
    `)

    await queryRunner.query(`
      DROP TYPE "application_stage"
    `)

    await queryRunner.query(`
      ALTER TYPE "application_stage_old" RENAME TO "application_stage"
    `)

    // interview_round_status enum is left in place; removing it could break dependent data.
  }
}
