import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { Application } from '../schema/application.entity'
import { Conversation } from '../schema/conversation.entity'
import { InterviewRound } from '../schema/interview-round.entity'
import { StageHistory } from '../schema/stage-history.entity'

@Injectable()
export class ActivityService {
  constructor(
    @InjectRepository(Application) private readonly appRepo: Repository<Application>,
    @InjectRepository(Conversation) private readonly convRepo: Repository<Conversation>,
    @InjectRepository(InterviewRound) private readonly roundRepo: Repository<InterviewRound>,
    @InjectRepository(StageHistory) private readonly histRepo: Repository<StageHistory>,
  ) {}

  async recomputeLastActivity(applicationId: string): Promise<void> {
    try {
      // Use a single query to get all the latest dates at once
      const result = await this.appRepo
        .createQueryBuilder('app')
        .select([
          'app.created_at as app_created',
          'MAX(conv.occurred_at) as latest_conv',
          'MAX(hist.changed_at) as latest_hist',
          'MAX(round.scheduled_at) as latest_round_scheduled',
          'MAX(round.completed_at) as latest_round_completed'
        ])
        .leftJoin('conversation', 'conv', 'conv.application_id = app.id')
        .leftJoin('stage_history', 'hist', 'hist.application_id = app.id')
        .leftJoin('interview_round', 'round', 'round.application_id = app.id')
        .where('app.id = :applicationId', { applicationId })
        .groupBy('app.id, app.created_at')
        .getRawOne<{
          app_created: Date
          latest_conv: Date | null
          latest_hist: Date | null
          latest_round_scheduled: Date | null
          latest_round_completed: Date | null
        }>()

      if (!result) {
        return // Application not found, skip update
      }

      // Find the latest date among all activities
      const dates = [
        result.app_created,
        result.latest_conv,
        result.latest_hist,
        result.latest_round_scheduled,
        result.latest_round_completed
      ].filter(Boolean) as Date[]

      if (dates.length === 0) {
        return // No activity dates found
      }

      const latest = dates.reduce((acc, d) => (acc > d ? acc : d))

      // Only update if the date has actually changed
      const app = await this.appRepo.findOne({ where: { id: applicationId } })
      if (app && app.last_activity_at.getTime() !== latest.getTime()) {
        app.last_activity_at = latest
        await this.appRepo.save(app)
      }
    } catch (error) {
      // Log error but don't fail the conversation creation
      console.error('Failed to recompute last activity for application:', applicationId, error)
    }
  }
}


