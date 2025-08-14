import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { Application } from '../../schema/application.entity'
import { Conversation } from '../../schema/conversation.entity'
import { InterviewRound } from '../../schema/interview-round.entity'
import { AnalyticsController } from './analytics.controller'
import { AnalyticsService } from './analytics.service'

@Module({
  imports: [TypeOrmModule.forFeature([Application, Conversation, InterviewRound])],
  controllers: [AnalyticsController],
  providers: [AnalyticsService],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}


