import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddUserPlatform1726000000000 implements MigrationInterface {
  name = 'AddUserPlatform1726000000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS user_platform (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id TEXT NOT NULL,
        platform_id UUID NOT NULL REFERENCES platform(id) ON DELETE CASCADE,
        rating SMALLINT NULL,
        notes TEXT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        UNIQUE (user_id, platform_id)
      )
    `)
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_user_platform_user ON user_platform(user_id)`)
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_user_platform_platform ON user_platform(platform_id)`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX IF EXISTS idx_user_platform_platform')
    await queryRunner.query('DROP INDEX IF EXISTS idx_user_platform_user')
    await queryRunner.query('DROP TABLE IF EXISTS user_platform')
  }
}


