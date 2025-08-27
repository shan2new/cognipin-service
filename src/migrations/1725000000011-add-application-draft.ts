import { MigrationInterface, QueryRunner, Table, TableIndex, TableForeignKey } from "typeorm"

export class AddApplicationDraft1725000000011 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(new Table({
      name: 'application_draft',
      columns: [
        { name: 'id', type: 'uuid', isPrimary: true, generationStrategy: 'uuid', default: 'uuid_generate_v4()' },
        { name: 'user_id', type: 'text', isNullable: false },
        { name: 'company_id', type: 'uuid', isNullable: true },
        { name: 'role', type: 'text', isNullable: true },
        { name: 'job_url', type: 'text', isNullable: true },
        { name: 'platform_id', type: 'uuid', isNullable: true },
        { name: 'source', type: 'text', isNullable: true },
        { name: 'compensation', type: 'jsonb', isNullable: true },
        { name: 'notes', type: 'jsonb', isNullable: true },
        { name: 'created_at', type: 'timestamptz', default: 'now()' },
        { name: 'updated_at', type: 'timestamptz', default: 'now()' },
      ],
    }))

    await queryRunner.createIndex('application_draft', new TableIndex({ name: 'idx_app_draft_user', columnNames: ['user_id'] }))

    await queryRunner.createForeignKey('application_draft', new TableForeignKey({
      columnNames: ['company_id'],
      referencedColumnNames: ['id'],
      referencedTableName: 'company',
      onDelete: 'SET NULL',
    }))

    await queryRunner.createForeignKey('application_draft', new TableForeignKey({
      columnNames: ['platform_id'],
      referencedColumnNames: ['id'],
      referencedTableName: 'platform',
      onDelete: 'SET NULL',
    }))
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS application_draft')
  }
}


