import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { ConfigModule } from '@nestjs/config'
import { Application } from '../../schema/application.entity'
import { ApplicationCompensation } from '../../schema/application-compensation.entity'
import { ApplicationNote } from '../../schema/application-note.entity'
import { Company } from '../../schema/company.entity'
import { ApplicationsController } from './applications.controller'
import { ApplicationsService } from './applications.service'
import { ApplicationQASnapshot } from '../../schema/application-qa-snapshot.entity'
import { StageHistory } from '../../schema/stage-history.entity'
import { ApplicationContact } from '../../schema/application-contact.entity'
import { Conversation } from '../../schema/conversation.entity'
import { InterviewRound } from '../../schema/interview-round.entity'
import { R2StorageService } from '../../lib/r2-storage.service'

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([
      Application,
      ApplicationCompensation,
      Company,
      StageHistory,
      ApplicationQASnapshot,
      ApplicationContact,
      ApplicationNote,
      Conversation,
      InterviewRound,
    ]),
  ],
  controllers: [ApplicationsController],
  providers: [ApplicationsService, R2StorageService],
  exports: [ApplicationsService],
})
export class ApplicationsModule {}


