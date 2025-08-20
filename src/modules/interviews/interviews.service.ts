import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { Application } from '../../schema/application.entity'
import { InterviewRound, InterviewRoundStatus } from '../../schema/interview-round.entity'
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

  async schedule(userId: string, appId: string, body: { type: string; scheduled_at?: string; mode?: string; custom_name?: string }) {
    const app = await this.appRepo.findOne({ where: { id: appId, user_id: userId } })
    if (!app) throw new NotFoundException('Application not found')
    const nextIndex = (await this.roundRepo.count({ where: { application_id: appId } })) + 1
    
    const status: InterviewRoundStatus = body.scheduled_at ? 'scheduled' : 'unscheduled'
    
    const round = await this.roundRepo.save(
      this.roundRepo.create({
        application_id: appId,
        round_index: nextIndex,
        type: body.type as any,
        custom_name: body.custom_name,
        status,
        scheduled_at: body.scheduled_at ? new Date(body.scheduled_at) : null,
        mode: (body.mode as any) || 'online',
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
    
    if (!['scheduled', 'rescheduled'].includes(round.status)) {
      throw new BadRequestException('Round can only be rescheduled when scheduled')
    }
    
    round.scheduled_at = new Date(body.scheduled_at)
    round.rescheduled_count = (round.rescheduled_count ?? 0) + 1
    round.status = 'rescheduled'
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
    round.status = 'completed'
    await this.roundRepo.save(round)
    await this.activity.recomputeLastActivity(appId)
    return round
  }

  async reject(
    userId: string,
    appId: string,
    roundId: string,
    body: { rejection_reason?: string },
  ) {
    const app = await this.appRepo.findOne({ where: { id: appId, user_id: userId } })
    if (!app) throw new NotFoundException('Application not found')
    const round = await this.roundRepo.findOne({ where: { id: roundId, application_id: appId } })
    if (!round) throw new NotFoundException('Round not found')
    
    round.status = 'rejected'
    round.rejection_reason = body.rejection_reason || null
    await this.roundRepo.save(round)
    await this.activity.recomputeLastActivity(appId)
    return round
  }

  async withdraw(
    userId: string,
    appId: string,
    roundId: string,
    body: { rejection_reason?: string },
  ) {
    const app = await this.appRepo.findOne({ where: { id: appId, user_id: userId } })
    if (!app) throw new NotFoundException('Application not found')
    const round = await this.roundRepo.findOne({ where: { id: roundId, application_id: appId } })
    if (!round) throw new NotFoundException('Round not found')
    
    round.status = 'withdrawn'
    round.rejection_reason = body.rejection_reason || null
    await this.roundRepo.save(round)
    await this.activity.recomputeLastActivity(appId)
    return round
  }

  async updateName(
    userId: string,
    appId: string,
    roundId: string,
    body: { custom_name: string },
  ) {
    const app = await this.appRepo.findOne({ where: { id: appId, user_id: userId } })
    if (!app) throw new NotFoundException('Application not found')
    const round = await this.roundRepo.findOne({ where: { id: roundId, application_id: appId } })
    if (!round) throw new NotFoundException('Round not found')
    
    round.custom_name = body.custom_name
    await this.roundRepo.save(round)
    return round
  }
}


