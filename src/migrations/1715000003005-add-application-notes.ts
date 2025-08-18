import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddApplicationNotes1715000003005 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "application_note" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "application_id" uuid NOT NULL,
        "user_id" text NOT NULL,
        "content" text NOT NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_application_note" PRIMARY KEY ("id")
      )
    `)

    await queryRunner.query(`
      CREATE INDEX "idx_application_note_application" ON "application_note" ("application_id")
    `)

    await queryRunner.query(`
      ALTER TABLE "application_note" ADD CONSTRAINT "FK_application_note_application" 
      FOREIGN KEY ("application_id") REFERENCES "application"("id") ON DELETE CASCADE ON UPDATE NO ACTION
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "application_note" DROP CONSTRAINT "FK_application_note_application"`)
    await queryRunner.query(`DROP INDEX "idx_application_note_application"`)
    await queryRunner.query(`DROP TABLE "application_note"`)
  }
}
