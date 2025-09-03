import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddUserAutofillState1738000000000 implements MigrationInterface {
  name = 'AddUserAutofillState1738000000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "user_autofill_state" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "user_id" text NOT NULL,
        "state" jsonb NOT NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_user_autofill_state" PRIMARY KEY ("id")
      )
    `)
    await queryRunner.query(`
      CREATE UNIQUE INDEX "idx_user_autofill_state_user" ON "user_autofill_state" ("user_id")
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "idx_user_autofill_state_user"`)
    await queryRunner.query(`DROP TABLE "user_autofill_state"`)
  }
}


