import { Injectable, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository, LessThan } from 'typeorm'
import { Application } from '../../schema/application.entity'
import { Conversation } from '../../schema/conversation.entity'
import { ActivityService } from '../../lib/activity.service'

@Injectable()
export class ConversationsService {
  constructor(
    @InjectRepository(Application) private readonly appRepo: Repository<Application>,
    @InjectRepository(Conversation) private readonly convRepo: Repository<Conversation>,
    private readonly activity: ActivityService,
  ) {}

  async list(userId: string, appId: string, opts: { limit?: number; before?: string | undefined }) {
    const app = await this.appRepo.findOne({ where: { id: appId, user_id: userId } })
    if (!app) throw new NotFoundException('Application not found')
    const where: any = { application_id: appId }
    if (opts.before) where.occurred_at = LessThan(new Date(opts.before))
    const items = await this.convRepo.find({ where, order: { occurred_at: 'DESC' }, take: opts.limit ?? 50 })
    return items
  }

  async add(
    userId: string,
    appId: string,
    body: { contact_id?: string; medium: string; direction: string; text: string; occurred_at?: string },
  ) {
    const app = await this.appRepo.findOne({ where: { id: appId, user_id: userId } })
    if (!app) throw new NotFoundException('Application not found')
    const occurredAt = body.occurred_at ? new Date(body.occurred_at) : new Date()
    const conv = await this.convRepo.save(
      this.convRepo.create({
        application_id: appId,
        contact_id: body.contact_id ?? null,
        medium: body.medium as any,
        direction: body.direction as any,
        text: body.text,
        occurred_at: occurredAt,
      }),
    )
    await this.activity.recomputeLastActivity(appId)
    return conv
  }
}


