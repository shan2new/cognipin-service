import { MigrationInterface, QueryRunner } from "typeorm"

export class DropMailAccountOAuthColumns1730000001000 implements MigrationInterface {
  name = 'DropMailAccountOAuthColumns1730000001000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE mail_account
      DROP COLUMN IF EXISTS refresh_token_enc,
      DROP COLUMN IF EXISTS access_token_enc,
      DROP COLUMN IF EXISTS token_scopes;
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Restore columns with same types as original baseline migration
    await queryRunner.query(`
      ALTER TABLE mail_account
      ADD COLUMN IF NOT EXISTS refresh_token_enc text NOT NULL DEFAULT '';
    `)
    // Remove default to match original schema
    await queryRunner.query(`
      ALTER TABLE mail_account ALTER COLUMN refresh_token_enc DROP DEFAULT;
    `)
    await queryRunner.query(`
      ALTER TABLE mail_account
      ADD COLUMN IF NOT EXISTS access_token_enc text NULL,
      ADD COLUMN IF NOT EXISTS token_scopes text NULL;
    `)
  }
}


