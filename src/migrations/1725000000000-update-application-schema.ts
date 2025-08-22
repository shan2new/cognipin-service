import { MigrationInterface, QueryRunner } from 'typeorm'

export class UpdateApplicationSchema1725000000000 implements MigrationInterface {
  name = 'UpdateApplicationSchema1725000000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Update application_milestone enum
    await queryRunner.query(`
      ALTER TYPE "application_milestone" RENAME TO "application_milestone_old";
    `)
    await queryRunner.query(`
      CREATE TYPE "application_milestone" AS ENUM('exploration', 'screening', 'interviewing', 'post_interview');
    `)
    await queryRunner.query(`
      ALTER TABLE "application" ALTER COLUMN "milestone" TYPE "application_milestone" USING "milestone"::text::"application_milestone";
    `)
    await queryRunner.query(`
      DROP TYPE "application_milestone_old";
    `)

    // Update application_stage enum
    await queryRunner.query(`
      ALTER TYPE "application_stage" RENAME TO "application_stage_old";
    `)
    await queryRunner.query(`
      CREATE TYPE "application_stage" AS ENUM('wishlist', 'recruiter_reachout', 'self_review', 'hr_shortlist', 'hm_shortlist', 'offer');
    `)
    await queryRunner.query(`
      ALTER TABLE "application" ALTER COLUMN "stage" TYPE "application_stage" USING 
        CASE 
          WHEN "stage"::text IN ('applied_self', 'applied_referral') THEN 'self_review'
          WHEN "stage"::text = 'recruiter_outreach' THEN 'recruiter_reachout'
          WHEN "stage"::text = 'hr_shortlisted' THEN 'hr_shortlist'
          WHEN "stage"::text = 'hm_shortlisted' THEN 'hm_shortlist'
          WHEN "stage"::text IN ('interview_scheduled', 'interview_rescheduled', 'interview_completed', 'interview_passed', 'interview_rejected') THEN 'offer'
          WHEN "stage"::text IN ('offer', 'accepted') THEN 'offer'
          ELSE 'wishlist'
        END::"application_stage";
    `)
    
    // Update stage_history table columns if it exists
    await queryRunner.query(`
      DO $$ 
      BEGIN
        IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'stage_history') THEN
          ALTER TABLE "stage_history" ALTER COLUMN "from_stage" TYPE "application_stage" USING 
            CASE 
              WHEN "from_stage"::text IN ('applied_self', 'applied_referral') THEN 'self_review'
              WHEN "from_stage"::text = 'recruiter_outreach' THEN 'recruiter_reachout'
              WHEN "from_stage"::text = 'hr_shortlisted' THEN 'hr_shortlist'
              WHEN "from_stage"::text = 'hm_shortlisted' THEN 'hm_shortlist'
              WHEN "from_stage"::text IN ('interview_scheduled', 'interview_rescheduled', 'interview_completed', 'interview_passed', 'interview_rejected') THEN 'offer'
              WHEN "from_stage"::text IN ('offer', 'accepted') THEN 'offer'
              ELSE 'wishlist'
            END::"application_stage";
            
          ALTER TABLE "stage_history" ALTER COLUMN "to_stage" TYPE "application_stage" USING 
            CASE 
              WHEN "to_stage"::text IN ('applied_self', 'applied_referral') THEN 'self_review'
              WHEN "to_stage"::text = 'recruiter_outreach' THEN 'recruiter_reachout'
              WHEN "to_stage"::text = 'hr_shortlisted' THEN 'hr_shortlist'
              WHEN "to_stage"::text = 'hm_shortlisted' THEN 'hm_shortlist'
              WHEN "to_stage"::text IN ('interview_scheduled', 'interview_rescheduled', 'interview_completed', 'interview_passed', 'interview_rejected') THEN 'offer'
              WHEN "to_stage"::text IN ('offer', 'accepted') THEN 'offer'
              ELSE 'wishlist'
            END::"application_stage";
        END IF;
      END $$;
    `)
    
    await queryRunner.query(`
      DROP TYPE "application_stage_old";
    `)

    // Update interview_round_type default to DSA
    await queryRunner.query(`
      ALTER TABLE "interview_round" ALTER COLUMN "type" SET DEFAULT 'dsa';
    `)

    // Update milestones based on new stage values
    await queryRunner.query(`
      UPDATE "application" SET "milestone" = 
        CASE 
          WHEN "stage"::text IN ('wishlist', 'recruiter_reachout', 'self_review') THEN 'exploration'
          WHEN "stage"::text IN ('hr_shortlist', 'hm_shortlist') THEN 'screening'
          WHEN "stage"::text = 'offer' THEN 'post_interview'
          ELSE 'interviewing'
        END::"application_milestone";
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Revert interview_round_type default
    await queryRunner.query(`
      ALTER TABLE "interview_round" ALTER COLUMN "type" SET DEFAULT 'screen';
    `)

    // Revert application_stage enum
    await queryRunner.query(`
      ALTER TYPE "application_stage" RENAME TO "application_stage_new";
    `)
    await queryRunner.query(`
      CREATE TYPE "application_stage" AS ENUM('recruiter_outreach', 'applied_self', 'applied_referral', 'hr_shortlisted', 'hm_shortlisted', 'interview_shortlist', 'interview_scheduled', 'interview_rescheduled', 'interview_completed', 'interview_passed', 'interview_rejected', 'offer', 'rejected', 'on_hold', 'withdrawn', 'accepted');
    `)
    await queryRunner.query(`
      ALTER TABLE "application" ALTER COLUMN "stage" TYPE "application_stage" USING 
        CASE 
          WHEN "stage"::text = 'self_review' THEN 'applied_self'
          WHEN "stage"::text = 'recruiter_reachout' THEN 'recruiter_outreach'
          WHEN "stage"::text = 'hr_shortlist' THEN 'hr_shortlisted'
          WHEN "stage"::text = 'hm_shortlist' THEN 'hm_shortlisted'
          WHEN "stage"::text = 'offer' THEN 'offer'
          ELSE 'applied_self'
        END::"application_stage";
    `)
    await queryRunner.query(`
      DROP TYPE "application_stage_new";
    `)

    // Revert application_milestone enum
    await queryRunner.query(`
      ALTER TYPE "application_milestone" RENAME TO "application_milestone_new";
    `)
    await queryRunner.query(`
      CREATE TYPE "application_milestone" AS ENUM('exploration', 'interviewing', 'post_interview');
    `)
    await queryRunner.query(`
      ALTER TABLE "application" ALTER COLUMN "milestone" TYPE "application_milestone" USING 
        CASE 
          WHEN "milestone"::text IN ('exploration', 'screening') THEN 'exploration'
          WHEN "milestone"::text = 'post_interview' THEN 'post_interview'
          ELSE 'interviewing'
        END::"application_milestone";
    `)
    await queryRunner.query(`
      DROP TYPE "application_milestone_new";
    `)
  }
}
