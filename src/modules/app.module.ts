import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { DataSourceOptions } from 'typeorm'
import { ProblemsModule } from './problems/problems.module'
import { ProgressModule } from './progress/progress.module'
import { ClerkAuthModule } from './auth/clerk.module'
import { RoadmapModule } from './roadmap/roadmap.module'
import ormConfig from '../ormconfig'
import { AppController } from '../app.controller'

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const databaseUrl = config.get<string>('DATABASE_URL')
        return {
          ...(ormConfig as DataSourceOptions),
          url: databaseUrl,
        } as DataSourceOptions
      },
    }),
    ClerkAuthModule,
    ProblemsModule,
    ProgressModule,
    RoadmapModule,
  ],
  controllers: [AppController],
})
export class AppModule {}



