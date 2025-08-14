import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { Application } from '../../schema/application.entity'
import { InterviewRound } from '../../schema/interview-round.entity'
import { ActivityService } from '../../lib/activity.service'

@Injectable()
export class InterviewsService {
  constructor(
    @InjectRepository(Application) private readonly appRepo: Repository<Application>,
    @InjectRepository(InterviewRound) private readonly roundRepo: Repository<InterviewRound>,
    private readonly activity: ActivityService,
  ) {}

  async list(userId: string, appId: string) {
    const app = await this.appRepo.findOne({ where: { id: appId, user_id: userId } })
    if (!app) throw new NotFoundException('Application not found')
    return this.roundRepo.find({ where: { application_id: appId }, order: { round_index: 'ASC' } })
  }

  async schedule(userId: string, appId: string, body: { type: string; scheduled_at: string; mode: string }) {
    const app = await this.appRepo.findOne({ where: { id: appId, user_id: userId } })
    if (!app) throw new NotFoundException('Application not found')
    const nextIndex = (await this.roundRepo.count({ where: { application_id: appId } })) + 1
    const round = await this.roundRepo.save(
      this.roundRepo.create({
        application_id: appId,
        round_index: nextIndex,
        type: body.type as any,
        scheduled_at: new Date(body.scheduled_at),
        mode: body.mode as any,
      }),
    )
    await this.activity.recomputeLastActivity(appId)
    return round
  }

  async reschedule(userId: string, appId: string, roundId: string, body: { scheduled_at: string }) {
    const app = await this.appRepo.findOne({ where: { id: appId, user_id: userId } })
    if (!app) throw new NotFoundException('Application not found')
    const round = await this.roundRepo.findOne({ where: { id: roundId, application_id: appId } })
    if (!round) throw new NotFoundException('Round not found')
    if (!['interview_scheduled', 'interview_rescheduled'].includes((app as any).stage)) {
      // soft guard; state machine enforced at transition endpoint
      throw new BadRequestException('Round can be rescheduled only when scheduled')
    }
    round.scheduled_at = new Date(body.scheduled_at)
    round.rescheduled_count = (round.rescheduled_count ?? 0) + 1
    await this.roundRepo.save(round)
    await this.activity.recomputeLastActivity(appId)
    return round
  }

  async complete(
    userId: string,
    appId: string,
    roundId: string,
    body: { started_at?: string; completed_at: string; result: string; feedback?: string },
  ) {
    const app = await this.appRepo.findOne({ where: { id: appId, user_id: userId } })
    if (!app) throw new NotFoundException('Application not found')
    const round = await this.roundRepo.findOne({ where: { id: roundId, application_id: appId } })
    if (!round) throw new NotFoundException('Round not found')
    round.started_at = body.started_at ? new Date(body.started_at) : round.started_at
    round.completed_at = new Date(body.completed_at)
    round.result = body.result as any
    round.feedback = body.feedback ?? round.feedback
    await this.roundRepo.save(round)
    await this.activity.recomputeLastActivity(appId)
    return round
  }
}


