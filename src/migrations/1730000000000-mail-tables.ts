import { MigrationInterface, QueryRunner } from "typeorm"

export class MailTables1730000000000 implements MigrationInterface {
  name = 'MailTables1730000000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE contact_channel_medium AS ENUM ('email','linkedin','phone','whatsapp','other');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `)
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS mail_account (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id text NOT NULL,
        provider text NOT NULL DEFAULT 'gmail',
        email text NOT NULL,
        last_history_id text NULL,
        last_sync_at timestamptz NULL,
        watch_expiration timestamptz NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );
    `)
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_mail_account_user ON mail_account(user_id)`)

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS mail_thread (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        account_id uuid NOT NULL REFERENCES mail_account(id) ON DELETE CASCADE,
        gmail_thread_id text NOT NULL,
        subject text NULL,
        snippet text NULL,
        preview_from jsonb NULL,
        preview_to jsonb NULL,
        latest_at timestamptz NOT NULL,
        application_id uuid NULL,
        assigned_by text NULL,
        assigned_at timestamptz NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );
    `)
    await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_mail_thread_gmail_id ON mail_thread(gmail_thread_id)`)

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE conversation_direction AS ENUM ('outbound','inbound');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `)
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE conversation_sender AS ENUM ('user','contact');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `)

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS mail_message (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        thread_id uuid NOT NULL REFERENCES mail_thread(id) ON DELETE CASCADE,
        gmail_message_id text NOT NULL,
        internal_date timestamptz NOT NULL,
        headers jsonb NULL,
        "from" jsonb NULL,
        "to" jsonb NULL,
        cc jsonb NULL,
        bcc jsonb NULL,
        subject text NULL,
        body_text text NULL,
        body_html text NULL,
        label_ids jsonb NULL,
        has_attachments boolean NOT NULL DEFAULT false,
        direction conversation_direction NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now()
      );
    `)
    await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_mail_message_gmail_id ON mail_message(gmail_message_id)`)

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS mail_attachment (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        message_id uuid NOT NULL REFERENCES mail_message(id) ON DELETE CASCADE,
        filename text NOT NULL,
        mime_type text NULL,
        size integer NULL,
        storage_key text NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now()
      );
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS mail_attachment`)
    await queryRunner.query(`DROP TABLE IF EXISTS mail_message`)
    await queryRunner.query(`DROP TYPE IF EXISTS conversation_sender`)
    await queryRunner.query(`DROP TYPE IF EXISTS conversation_direction`)
    await queryRunner.query(`DROP TABLE IF EXISTS mail_thread`)
    await queryRunner.query(`DROP INDEX IF EXISTS idx_mail_thread_gmail_id`)
    await queryRunner.query(`DROP TABLE IF EXISTS mail_account`)
    await queryRunner.query(`DROP INDEX IF EXISTS idx_mail_account_user`)
    await queryRunner.query(`DROP TYPE IF EXISTS contact_channel_medium`)
  }
}


