import { Injectable, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository, LessThan } from 'typeorm'
import { Application } from '../../schema/application.entity'
import { Conversation, ConversationSender, ContactChannelMedium } from '../../schema/conversation.entity'
import { Contact } from '../../schema/contact.entity'
import { ActivityService } from '../../lib/activity.service'

@Injectable()
export class ConversationsService {
  constructor(
    @InjectRepository(Application) private readonly appRepo: Repository<Application>,
    @InjectRepository(Conversation) private readonly convRepo: Repository<Conversation>,
    @InjectRepository(Contact) private readonly contactRepo: Repository<Contact>,
    private readonly activity: ActivityService,
  ) {}

  async list(userId: string, appId: string, opts: { limit?: number; before?: string | undefined }) {
    const app = await this.appRepo.findOne({ where: { id: appId, user_id: userId } })
    if (!app) throw new NotFoundException('Application not found')
    const where: any = { application_id: appId }
    if (opts.before) where.occurred_at = LessThan(new Date(opts.before))
    const items = await this.convRepo.find({ 
      where, 
      order: { occurred_at: 'ASC' }, 
      take: opts.limit ?? 50,
      relations: ['contact']
    })
    return items
  }

  async add(
    userId: string,
    appId: string,
    body: { 
      contact_id?: string; 
      medium?: string | null; 
      direction: string; 
      text: string; 
      occurred_at?: string;
      sender?: ConversationSender;
      contact?: { name: string; title?: string | null }
    },
  ) {
    const app = await this.appRepo.findOne({ where: { id: appId, user_id: userId } })
    if (!app) throw new NotFoundException('Application not found')
    
    let contactId = body.contact_id ?? null
    
    // Create contact inline if provided
    if (!contactId && body.contact) {
      const newContact = await this.contactRepo.save(
        this.contactRepo.create({
          name: body.contact.name,
          title: body.contact.title ?? null,
        })
      )
      contactId = newContact.id
    }
    
    const occurredAt = body.occurred_at ? new Date(body.occurred_at) : new Date()
    const conv = await this.convRepo.save(
      this.convRepo.create({
        application_id: appId,
        contact_id: contactId,
        medium: body.medium as ContactChannelMedium | null,
        direction: body.direction as any,
        text: body.text,
        sender: body.sender || 'user',
        occurred_at: occurredAt,
      }),
    )
    
    // Load the contact relation for response
    const fullConv = await this.convRepo.findOne({
      where: { id: conv.id },
      relations: ['contact']
    })
    
    // Make activity recomputation asynchronous to prevent blocking
    this.activity.recomputeLastActivity(appId).catch(error => {
      console.error('Failed to recompute activity for conversation:', error)
    })
    
    return fullConv
  }
}


