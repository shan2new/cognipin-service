import { MigrationInterface, QueryRunner } from "typeorm"

export class EnrichMailEntities1735000000000 implements MigrationInterface {
  name = 'EnrichMailEntities1735000000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE mail_thread
        ADD COLUMN IF NOT EXISTS label_ids jsonb NULL,
        ADD COLUMN IF NOT EXISTS message_count integer NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS unread_count integer NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS gmail_history_id text NULL,
        ADD COLUMN IF NOT EXISTS last_message_id uuid NULL;
    `)
    await queryRunner.query(`
      ALTER TABLE mail_message
        ADD COLUMN IF NOT EXISTS mime_type text NULL,
        ADD COLUMN IF NOT EXISTS snippet text NULL,
        ADD COLUMN IF NOT EXISTS calendar_event_id text NULL;
    `)
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_mail_thread_latest_at ON mail_thread (latest_at DESC)`)
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_mail_thread_labels ON mail_thread USING GIN (label_ids)`)
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_mail_message_labels ON mail_message USING GIN (label_ids)`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_mail_message_labels`)
    await queryRunner.query(`DROP INDEX IF EXISTS idx_mail_thread_labels`)
    await queryRunner.query(`DROP INDEX IF EXISTS idx_mail_thread_latest_at`)
    await queryRunner.query(`
      ALTER TABLE mail_message
        DROP COLUMN IF EXISTS calendar_event_id,
        DROP COLUMN IF EXISTS snippet,
        DROP COLUMN IF EXISTS mime_type;
    `)
    await queryRunner.query(`
      ALTER TABLE mail_thread
        DROP COLUMN IF EXISTS last_message_id,
        DROP COLUMN IF EXISTS gmail_history_id,
        DROP COLUMN IF EXISTS unread_count,
        DROP COLUMN IF EXISTS message_count,
        DROP COLUMN IF EXISTS label_ids;
    `)
  }
}


