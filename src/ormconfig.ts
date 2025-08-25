import 'dotenv/config'
import { DataSourceOptions } from 'typeorm'

const isTypeScriptRuntime = __filename.endsWith('.ts')

const ormConfig: DataSourceOptions = {
  type: 'postgres',
  url: process.env.DATABASE_URL,
  entities: [
    // Load all entity classes without hand-maintaining the list
    isTypeScriptRuntime ? 'src/schema/*.entity.ts' : 'dist/schema/*.entity.js',
  ],
  synchronize: false,
  migrations: [isTypeScriptRuntime ? 'src/migrations/*.ts' : 'dist/migrations/*.js'],
  migrationsTableName: 'typeorm_migrations',
  logging: false,
}

export default ormConfig



