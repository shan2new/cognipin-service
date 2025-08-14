import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { DataSourceOptions } from 'typeorm'
import { ProblemsModule } from './problems/problems.module'
import { ProgressModule } from './progress/progress.module'
import { ClerkAuthModule } from './auth/clerk.module'
import { RoadmapModule } from './roadmap/roadmap.module'
import { CompaniesModule } from './companies/companies.module'
import { PlatformsModule } from './platforms/platforms.module'
import { ApplicationsModule } from './applications/applications.module'
import { ContactsModule } from './contacts/contacts.module'
import { ConversationsModule } from './conversations/conversations.module'
import { InterviewsModule } from './interviews/interviews.module'
import { ProfileModule } from './profile/profile.module'
import { RecruiterQAModule } from './recruiter-qa/recruiter-qa.module'
import { AnalyticsModule } from './analytics/analytics.module'
import { ReferrersModule } from './referrers/referrers.module'
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
          autoLoadEntities: true,
        } as DataSourceOptions
      },
    }),
    ClerkAuthModule,
    ProblemsModule,
    ProgressModule,
    RoadmapModule,
    CompaniesModule,
    PlatformsModule,
    ApplicationsModule,
    ContactsModule,
    ConversationsModule,
    InterviewsModule,
    ProfileModule,
    RecruiterQAModule,
    AnalyticsModule,
    ReferrersModule,
  ],
  controllers: [AppController],
})
export class AppModule {}



