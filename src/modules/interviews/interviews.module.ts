import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { Application } from '../../schema/application.entity'
import { InterviewRound } from '../../schema/interview-round.entity'
import { InterviewsController } from './interviews.controller'
import { InterviewsService } from './interviews.service'
import { ActivityService } from '../../lib/activity.service'
import { Conversation } from '../../schema/conversation.entity'
import { StageHistory } from '../../schema/stage-history.entity'

@Module({
  imports: [TypeOrmModule.forFeature([Application, InterviewRound, Conversation, StageHistory])],
  controllers: [InterviewsController],
  providers: [InterviewsService, ActivityService],
  exports: [InterviewsService],
})
export class InterviewsModule {}


