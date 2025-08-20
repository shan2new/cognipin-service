import { MigrationInterface, QueryRunner } from 'typeorm'

export class OptimizeActivityIndexes1715000003007 implements MigrationInterface {
  name = 'OptimizeActivityIndexes1715000003007'

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add indexes to improve activity service performance
    // These indexes will help with the MAX() aggregations in recomputeLastActivity
    
    // Index for conversation occurred_at lookups
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_conversation_occurred_at 
      ON conversation(application_id, occurred_at DESC)
    `)

    // Index for stage history changed_at lookups  
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_stage_history_changed_at 
      ON stage_history(application_id, changed_at DESC)
    `)

    // Index for interview round scheduled_at lookups
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_interview_round_scheduled_at 
      ON interview_round(application_id, scheduled_at DESC)
    `)

    // Index for interview round completed_at lookups
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_interview_round_completed_at 
      ON interview_round(application_id, completed_at DESC)
    `)

    // Index for application last_activity_at updates
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_application_last_activity_at 
      ON application(last_activity_at DESC)
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX IF EXISTS idx_application_last_activity_at')
    await queryRunner.query('DROP INDEX IF EXISTS idx_interview_round_completed_at')
    await queryRunner.query('DROP INDEX IF EXISTS idx_interview_round_scheduled_at')
    await queryRunner.query('DROP INDEX IF EXISTS idx_stage_history_changed_at')
    await queryRunner.query('DROP INDEX IF EXISTS idx_conversation_occurred_at')
  }
}
