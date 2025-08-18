import { MigrationInterface, QueryRunner } from 'typeorm'

export class UpdateConversations1715000003006 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add sender enum type
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE conversation_sender AS ENUM ('user', 'contact');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `)
    
    // Add sender column with default value
    await queryRunner.query(`
      ALTER TABLE conversation 
      ADD COLUMN IF NOT EXISTS sender conversation_sender DEFAULT 'user'
    `)
    
    // Make medium nullable to support user messages without a specific channel
    await queryRunner.query(`
      ALTER TABLE conversation 
      ALTER COLUMN medium DROP NOT NULL
    `)
    
    // Add created_at column if it doesn't exist
    await queryRunner.query(`
      ALTER TABLE conversation 
      ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW()
    `)
    
    // Update existing records to have sender based on direction
    await queryRunner.query(`
      UPDATE conversation 
      SET sender = CASE 
        WHEN direction = 'outbound' THEN 'user'::conversation_sender
        WHEN direction = 'inbound' THEN 'contact'::conversation_sender
        ELSE 'user'::conversation_sender
      END
      WHERE sender IS NULL
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE conversation DROP COLUMN IF EXISTS sender`)
    await queryRunner.query(`ALTER TABLE conversation DROP COLUMN IF EXISTS created_at`)
    await queryRunner.query(`ALTER TABLE conversation ALTER COLUMN medium SET NOT NULL`)
    await queryRunner.query(`DROP TYPE IF EXISTS conversation_sender`)
  }
}
