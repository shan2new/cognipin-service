import { MigrationInterface, QueryRunner } from 'typeorm'

export class UserReferrers1735000000000 implements MigrationInterface {
  name = 'UserReferrers1735000000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS user_referrer (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id TEXT NOT NULL,
        contact_id UUID NOT NULL REFERENCES contact(id) ON DELETE CASCADE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `)
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS user_referrer_company (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_referrer_id UUID NOT NULL REFERENCES user_referrer(id) ON DELETE CASCADE,
        company_id UUID NOT NULL REFERENCES company(id) ON DELETE CASCADE
      )
    `)
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_user_referrer_user ON user_referrer(user_id)
    `)
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_user_referrer_company_ref ON user_referrer_company(user_referrer_id)
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX IF EXISTS idx_user_referrer_company_ref')
    await queryRunner.query('DROP INDEX IF EXISTS idx_user_referrer_user')
    await queryRunner.query('DROP TABLE IF EXISTS user_referrer_company')
    await queryRunner.query('DROP TABLE IF EXISTS user_referrer')
  }
}


