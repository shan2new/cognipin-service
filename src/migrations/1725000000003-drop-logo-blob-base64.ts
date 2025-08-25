import { MigrationInterface, QueryRunner } from 'typeorm';

export class DropLogoBlobBase641725000000003 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Drop logo_blob_base64 column from companies table
    await queryRunner.query(`
      ALTER TABLE companies 
      DROP COLUMN IF EXISTS logo_blob_base64;
    `);

    // Drop logo_blob_base64 column from platforms table
    await queryRunner.query(`
      ALTER TABLE platforms 
      DROP COLUMN IF EXISTS logo_blob_base64;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Add logo_blob_base64 column back to companies table
    await queryRunner.query(`
      ALTER TABLE companies 
      ADD COLUMN logo_blob_base64 TEXT NULL;
    `);

    // Add logo_blob_base64 column back to platforms table
    await queryRunner.query(`
      ALTER TABLE platforms 
      ADD COLUMN logo_blob_base64 TEXT NULL;
    `);
  }
}
