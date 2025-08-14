import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { Application } from '../../schema/application.entity'
import { Conversation } from '../../schema/conversation.entity'
import { ConversationsController } from './conversations.controller'
import { ConversationsService } from './conversations.service'
import { ActivityService } from '../../lib/activity.service'
import { InterviewRound } from '../../schema/interview-round.entity'
import { StageHistory } from '../../schema/stage-history.entity'

@Module({
  imports: [TypeOrmModule.forFeature([Application, Conversation, InterviewRound, StageHistory])],
  controllers: [ConversationsController],
  providers: [ConversationsService, ActivityService],
  exports: [ConversationsService],
})
export class ConversationsModule {}


