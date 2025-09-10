import { MigrationInterface, QueryRunner } from 'typeorm'

export class BackfillProjectsIntoSections1737000000001 implements MigrationInterface {
  name = 'BackfillProjectsIntoSections1737000000001'

  public async up(queryRunner: QueryRunner): Promise<void> {
    // If resume.additional_section contains items with type='projects' and resume.sections
    // does not already include a 'projects' section, append a canonical 'projects' section
    // whose content is the concatenation of all additional_section[projects].content arrays.
    await queryRunner.query(`
      UPDATE "resume" r
      SET sections = (
        COALESCE(r.sections, '[]'::jsonb) || (
          SELECT jsonb_build_object(
            'id', 'projects',
            'type', 'projects',
            'title', 'Projects',
            'order', COALESCE(jsonb_array_length(r.sections), 0),
            'content', COALESCE((
              SELECT jsonb_agg(elem) FROM (
                SELECT jsonb_array_elements(COALESCE(sec->'content', '[]'::jsonb)) elem
                FROM jsonb_array_elements(COALESCE(r.additional_section, '[]'::jsonb)) sec
                WHERE sec->>'type' = 'projects'
              ) AS z
            ), '[]'::jsonb)
          )
        )
      ),
      additional_section = (
        SELECT COALESCE(jsonb_agg(sec) FILTER (WHERE sec->>'type' <> 'projects'), '[]'::jsonb)
        FROM jsonb_array_elements(COALESCE(r.additional_section, '[]'::jsonb)) sec
      )
      WHERE EXISTS (
        SELECT 1 FROM jsonb_array_elements(COALESCE(r.additional_section, '[]'::jsonb)) sec
        WHERE sec->>'type' = 'projects'
      )
      AND NOT EXISTS (
        SELECT 1 FROM jsonb_array_elements(COALESCE(r.sections, '[]'::jsonb)) s
        WHERE s->>'type' = 'projects'
      )
    `)
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // No-op: safe to leave the canonical section in place
  }
}



