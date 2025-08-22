import { MigrationInterface, QueryRunner } from 'typeorm'

export class RestructureInterviewStages1725000000002 implements MigrationInterface {
  name = 'RestructureInterviewStages1725000000002'

  public async up(queryRunner: QueryRunner): Promise<void> {
    // First, change dependent columns to text type
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'stage_history') THEN
          ALTER TABLE "stage_history" ALTER COLUMN "from_stage" TYPE text;
          ALTER TABLE "stage_history" ALTER COLUMN "to_stage" TYPE text;
        END IF;
      END $$;
    `)
    
    // Change application stage column from enum to text to allow dynamic interview round stages
    await queryRunner.query(`ALTER TABLE "application" ALTER COLUMN "stage" TYPE text`)
    
    // Now we can safely drop the old application_stage enum
    await queryRunner.query(`DROP TYPE IF EXISTS "application_stage"`)
    
    // Update existing "interviewing" stage records to "interview_round_1"
    // This assumes applications in interviewing stage become the first interview round
    await queryRunner.query(`UPDATE "application" SET "stage" = 'interview_round_1' WHERE "stage" = 'interviewing'`)
    
    // Update stage_history records if they exist
    await queryRunner.query(`UPDATE "stage_history" SET "from_stage" = 'interview_round_1' WHERE "from_stage" = 'interviewing'`)
    await queryRunner.query(`UPDATE "stage_history" SET "to_stage" = 'interview_round_1' WHERE "to_stage" = 'interviewing'`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Revert interview_round_* stages back to interviewing
    await queryRunner.query(`UPDATE "application" SET "stage" = 'interviewing' WHERE "stage" LIKE 'interview_round_%'`)
    
    // Update stage_history records if they exist  
    await queryRunner.query(`UPDATE "stage_history" SET "from_stage" = 'interviewing' WHERE "from_stage" LIKE 'interview_round_%'`)
    await queryRunner.query(`UPDATE "stage_history" SET "to_stage" = 'interviewing' WHERE "to_stage" LIKE 'interview_round_%'`)
    
    // Recreate the enum and set the column back to enum
    await queryRunner.query(`CREATE TYPE "application_stage" AS ENUM('wishlist', 'recruiter_reachout', 'self_review', 'hr_shortlist', 'hm_shortlist', 'interviewing', 'offer')`)
    await queryRunner.query(`ALTER TABLE "application" ALTER COLUMN "stage" TYPE "application_stage" USING "stage"::"application_stage"`)
  }
}
