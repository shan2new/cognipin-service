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
    
    // If the round is currently unscheduled (or missing scheduled_at), treat this as the first schedule
    // Otherwise, mark it as a reschedule and increment the counter
    if (round.status === 'unscheduled' || !round.scheduled_at) {
      round.scheduled_at = new Date(body.scheduled_at)
      round.status = 'scheduled'
    } else {
      round.scheduled_at = new Date(body.scheduled_at)
      round.rescheduled_count = (round.rescheduled_count ?? 0) + 1
      round.status = 'rescheduled'
    }
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

  async updateType(
    userId: string,
    appId: string,
    roundId: string,
    body: { type: string },
  ) {
    const app = await this.appRepo.findOne({ where: { id: appId, user_id: userId } })
    if (!app) throw new NotFoundException('Application not found')
    const round = await this.roundRepo.findOne({ where: { id: roundId, application_id: appId } })
    if (!round) throw new NotFoundException('Round not found')
    
    round.type = body.type as any
    await this.roundRepo.save(round)
    await this.activity.recomputeLastActivity(appId)
    return round
  }
  
  async reorderRounds(
    userId: string,
    appId: string,
    body: { round_ids: string[] },
  ) {
    const app = await this.appRepo.findOne({ where: { id: appId, user_id: userId } })
    if (!app) throw new NotFoundException('Application not found')
    
    // Get all rounds for this application
    const rounds = await this.roundRepo.find({ where: { application_id: appId } })
    if (rounds.length === 0) return []
    
    // Check that all round_ids in the request actually belong to this application
    const allIdsFromApp = rounds.map(r => r.id).sort()
    const requestedIds = [...body.round_ids].sort() 
    
    if (requestedIds.length !== allIdsFromApp.length) {
      throw new BadRequestException('Request contains incorrect number of round IDs')
    }
    
    // Check that all IDs in the request belong to this app and that no extras are present
    const invalidIds = requestedIds.filter(id => !allIdsFromApp.includes(id))
    if (invalidIds.length > 0) {
      throw new BadRequestException(`Invalid round IDs: ${invalidIds.join(', ')}`)
    }
    
    // Phase 1: temporarily offset all current indices to avoid unique collisions
    for (const r of rounds) {
      await this.roundRepo.update({ id: r.id, application_id: appId }, { round_index: (r.round_index ?? 0) + 1000 })
    }

    // Phase 2: set final indices according to the requested order
    for (let index = 0; index < body.round_ids.length; index++) {
      const id = body.round_ids[index]
      await this.roundRepo.update({ id, application_id: appId }, { round_index: index + 1 })
    }
    await this.activity.recomputeLastActivity(appId)
    
    return this.roundRepo.find({ where: { application_id: appId }, order: { round_index: 'ASC' } })
  }
  
  async deleteRound(
    userId: string,
    appId: string,
    roundId: string,
  ) {
    const app = await this.appRepo.findOne({ where: { id: appId, user_id: userId } })
    if (!app) throw new NotFoundException('Application not found')
    
    // Find the round to delete
    const round = await this.roundRepo.findOne({ where: { id: roundId, application_id: appId } })
    if (!round) throw new NotFoundException('Round not found')
    
    // Delete the round
    await this.roundRepo.delete({ id: roundId, application_id: appId })
    
    // Renumber the remaining rounds to ensure contiguous round_index values
    const remainingRounds = await this.roundRepo.find({ 
      where: { application_id: appId },
      order: { round_index: 'ASC' } 
    })
    
    // Phase 1: offset all current indices to avoid unique collisions during renumbering
    for (const r of remainingRounds) {
      await this.roundRepo.update({ id: r.id }, { round_index: (r.round_index ?? 0) + 1000 })
    }

    // Phase 2: assign final contiguous indices
    for (let idx = 0; idx < remainingRounds.length; idx++) {
      const r = remainingRounds[idx]
      await this.roundRepo.update({ id: r.id }, { round_index: idx + 1 })
    }
    await this.activity.recomputeLastActivity(appId)
    
    return { deleted: true, id: roundId }
  }
}


