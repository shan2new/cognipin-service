import { MigrationInterface, QueryRunner } from 'typeorm'

export class BackfillUserPlatforms1726000000001 implements MigrationInterface {
  name = 'BackfillUserPlatforms1726000000001'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      INSERT INTO user_platform (user_id, platform_id, rating, notes)
      SELECT DISTINCT a.user_id, a.platform_id, NULL::smallint, NULL::text
      FROM application a
      WHERE a.platform_id IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM user_platform up WHERE up.user_id = a.user_id AND up.platform_id = a.platform_id
        )
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Non-destructive: keep backfilled data
  }
}


