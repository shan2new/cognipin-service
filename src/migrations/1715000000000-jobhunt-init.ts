import { MigrationInterface, QueryRunner } from 'typeorm'

export class JobhuntInit1715000000000 implements MigrationInterface {
  name = 'JobhuntInit1715000000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Ensure pgcrypto for gen_random_uuid()
    await queryRunner.query('CREATE EXTENSION IF NOT EXISTS pgcrypto')
    // Enums
    await queryRunner.query("CREATE TYPE contact_channel_medium AS ENUM ('email','linkedin','phone','whatsapp','other')")
    await queryRunner.query("CREATE TYPE application_source AS ENUM ('applied_self','applied_referral','recruiter_outreach')")
    await queryRunner.query("CREATE TYPE application_milestone AS ENUM ('exploration','interviewing','post_interview')")
    await queryRunner.query(
      "CREATE TYPE application_stage AS ENUM (\n        'recruiter_outreach','applied_self','applied_referral','recruiter_discussion','pending_shortlist','interview_shortlist',\n        'interview_scheduled','interview_rescheduled','interview_completed','interview_passed','interview_rejected',\n        'offer','rejected','on_hold','withdrawn','accepted'\n      )",
    )
    await queryRunner.query("CREATE TYPE application_status AS ENUM ('active','rejected','offer','accepted','withdrawn','on_hold')")
    await queryRunner.query(
      "CREATE TYPE application_contact_role AS ENUM ('recruiter','referrer','hiring_manager','interviewer','other')",
    )
    await queryRunner.query("CREATE TYPE conversation_direction AS ENUM ('outbound','inbound')")
    await queryRunner.query(
      "CREATE TYPE interview_round_type AS ENUM ('screen','dsa','system_design','coding','hm','bar_raiser','other')",
    )
    await queryRunner.query("CREATE TYPE interview_round_result AS ENUM ('passed','rejected','no_show','pending')")
    await queryRunner.query("CREATE TYPE interview_round_mode AS ENUM ('online','onsite')")
    await queryRunner.query("CREATE TYPE stage_history_by AS ENUM ('system','user')")
    await queryRunner.query(
      "CREATE TYPE recruiter_qa_key AS ENUM ('current_ctc','expected_ctc','notice_period','reason_leaving_current','past_leaving_reasons')",
    )

    // Tables
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS company (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        website_url TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        logo_blob_base64 TEXT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `)

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS platform (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL,
        url TEXT UNIQUE NOT NULL,
        logo_blob_base64 TEXT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `)

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS contact (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL,
        title TEXT NULL,
        notes TEXT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `)

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS contact_channel (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        contact_id UUID NOT NULL REFERENCES contact(id) ON DELETE CASCADE,
        medium contact_channel_medium NOT NULL,
        channel_value TEXT NOT NULL
      )
    `)

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS application (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id TEXT NOT NULL,
        company_id UUID NOT NULL REFERENCES company(id) ON DELETE RESTRICT,
        role TEXT NOT NULL,
        job_url TEXT NOT NULL,
        platform_id UUID NULL REFERENCES platform(id) ON DELETE SET NULL,
        source application_source NOT NULL,
        milestone application_milestone NOT NULL,
        stage application_stage NOT NULL,
        status application_status NOT NULL DEFAULT 'active',
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        last_activity_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        notes TEXT NULL,
        resume_variant TEXT NULL
      )
    `)

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_application_stage ON application(stage)
    `)
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_application_milestone ON application(milestone)
    `)
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_application_platform ON application(platform_id)
    `)
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_application_company ON application(company_id)
    `)
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_application_last_activity_desc ON application(last_activity_at DESC)
    `)

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS application_compensation (
        application_id UUID PRIMARY KEY REFERENCES application(id) ON DELETE CASCADE,
        fixed_min_lpa DECIMAL(6,2) NULL,
        fixed_max_lpa DECIMAL(6,2) NULL,
        var_min_lpa DECIMAL(6,2) NULL,
        var_max_lpa DECIMAL(6,2) NULL,
        tentative_ctc_note TEXT NULL
      )
    `)

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS application_contact (
        application_id UUID NOT NULL REFERENCES application(id) ON DELETE CASCADE,
        contact_id UUID NOT NULL REFERENCES contact(id) ON DELETE CASCADE,
        role application_contact_role NOT NULL,
        is_primary BOOLEAN NOT NULL DEFAULT false,
        PRIMARY KEY (application_id, contact_id)
      )
    `)

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS conversation (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        application_id UUID NOT NULL REFERENCES application(id) ON DELETE CASCADE,
        contact_id UUID NULL REFERENCES contact(id) ON DELETE SET NULL,
        medium contact_channel_medium NOT NULL,
        direction conversation_direction NOT NULL,
        text TEXT NOT NULL,
        occurred_at TIMESTAMPTZ NOT NULL
      )
    `)

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_conversation_app_time ON conversation(application_id, occurred_at)
    `)

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS interview_round (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        application_id UUID NOT NULL REFERENCES application(id) ON DELETE CASCADE,
        round_index INT NOT NULL,
        type interview_round_type NOT NULL,
        scheduled_at TIMESTAMPTZ NOT NULL,
        rescheduled_count INT NOT NULL DEFAULT 0,
        started_at TIMESTAMPTZ NULL,
        completed_at TIMESTAMPTZ NULL,
        result interview_round_result NOT NULL DEFAULT 'pending',
        feedback TEXT NULL,
        mode interview_round_mode NOT NULL
      )
    `)

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_interview_round_app_index ON interview_round(application_id, round_index)
    `)
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_interview_round_app_index ON interview_round(application_id, round_index)
    `)

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS stage_history (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        application_id UUID NOT NULL REFERENCES application(id) ON DELETE CASCADE,
        from_stage application_stage NOT NULL,
        to_stage application_stage NOT NULL,
        changed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        reason TEXT NULL,
        by stage_history_by NOT NULL
      )
    `)

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_stage_history_app_time ON stage_history(application_id, changed_at)
    `)

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS user_profile (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id TEXT NOT NULL UNIQUE,
        notice_period_days INT NULL,
        earliest_join_date DATE NULL,
        theme TEXT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `)

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS recruiter_qa (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id TEXT NOT NULL,
        key recruiter_qa_key NOT NULL,
        answer TEXT NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        UNIQUE (user_id, key)
      )
    `)

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS application_qa_snapshot (
        application_id UUID PRIMARY KEY REFERENCES application(id) ON DELETE CASCADE,
        current_ctc_text TEXT NULL,
        expected_ctc_text TEXT NULL,
        notice_period_text TEXT NULL,
        reason_leaving_current_text TEXT NULL,
        past_leaving_reasons_text TEXT NULL
      )
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop tables (reverse order due to FKs), then types
    await queryRunner.query('DROP TABLE IF EXISTS application_qa_snapshot')
    await queryRunner.query('DROP TABLE IF EXISTS recruiter_qa')
    await queryRunner.query('DROP TABLE IF EXISTS user_profile')
    await queryRunner.query('DROP INDEX IF EXISTS idx_stage_history_app_time')
    await queryRunner.query('DROP TABLE IF EXISTS stage_history')
    await queryRunner.query('DROP INDEX IF EXISTS uq_interview_round_app_index')
    await queryRunner.query('DROP INDEX IF EXISTS idx_interview_round_app_index')
    await queryRunner.query('DROP TABLE IF EXISTS interview_round')
    await queryRunner.query('DROP INDEX IF EXISTS idx_conversation_app_time')
    await queryRunner.query('DROP TABLE IF EXISTS conversation')
    await queryRunner.query('DROP TABLE IF EXISTS application_contact')
    await queryRunner.query('DROP TABLE IF EXISTS application_compensation')
    await queryRunner.query('DROP INDEX IF EXISTS idx_application_last_activity_desc')
    await queryRunner.query('DROP INDEX IF EXISTS idx_application_company')
    await queryRunner.query('DROP INDEX IF EXISTS idx_application_platform')
    await queryRunner.query('DROP INDEX IF EXISTS idx_application_milestone')
    await queryRunner.query('DROP INDEX IF EXISTS idx_application_stage')
    await queryRunner.query('DROP TABLE IF EXISTS application')
    await queryRunner.query('DROP TABLE IF EXISTS contact_channel')
    await queryRunner.query('DROP TABLE IF EXISTS contact')
    await queryRunner.query('DROP TABLE IF EXISTS platform')
    await queryRunner.query('DROP TABLE IF EXISTS company')

    // Drop types
    await queryRunner.query('DROP TYPE IF EXISTS recruiter_qa_key')
    await queryRunner.query('DROP TYPE IF EXISTS stage_history_by')
    await queryRunner.query('DROP TYPE IF EXISTS interview_round_mode')
    await queryRunner.query('DROP TYPE IF EXISTS interview_round_result')
    await queryRunner.query('DROP TYPE IF EXISTS interview_round_type')
    await queryRunner.query('DROP TYPE IF EXISTS conversation_direction')
    await queryRunner.query('DROP TYPE IF EXISTS application_contact_role')
    await queryRunner.query('DROP TYPE IF EXISTS application_status')
    await queryRunner.query('DROP TYPE IF EXISTS application_stage')
    await queryRunner.query('DROP TYPE IF EXISTS application_milestone')
    await queryRunner.query('DROP TYPE IF EXISTS application_source')
    await queryRunner.query('DROP TYPE IF EXISTS contact_channel_medium')
  }
}


