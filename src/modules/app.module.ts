import { Module } from '@nestjs/common'
import { TypeOrmModule, TypeOrmModuleOptions } from '@nestjs/typeorm'
import { ConfigModule, ConfigService } from '@nestjs/config'
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
import { ResumesModule } from './resumes/resumes.module'
import ormConfig from '../ormconfig'
import { AppController } from '../app.controller'
import { RolesModule } from './roles/roles.module'
import { MailModule } from './mail/mail.module'
import { AutofillModule } from './autofill/autofill.module'
import { CopilotModule } from './copilot/copilot.module'

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (): TypeOrmModuleOptions => {
        return {
          ...(ormConfig as unknown as TypeOrmModuleOptions),
          autoLoadEntities: true,
        }
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
    ResumesModule,
    RolesModule,
    MailModule,
    AutofillModule,
    CopilotModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
