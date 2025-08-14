import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { Application } from '../../schema/application.entity'
import { ApplicationContact } from '../../schema/application-contact.entity'
import { Contact } from '../../schema/contact.entity'
import { ContactChannel } from '../../schema/contact-channel.entity'

@Injectable()
export class ContactsService {
  constructor(
    @InjectRepository(Application) private readonly appRepo: Repository<Application>,
    @InjectRepository(Contact) private readonly contactRepo: Repository<Contact>,
    @InjectRepository(ContactChannel) private readonly channelRepo: Repository<ContactChannel>,
    @InjectRepository(ApplicationContact) private readonly appContactRepo: Repository<ApplicationContact>,
  ) {}

  async list(appId: string) {
    const acs = await this.appContactRepo.find({ where: { application_id: appId } })
    const ids = acs.map((x) => x.contact_id)
    const contacts = ids.length ? await this.contactRepo.findByIds(ids) : []
    const channels = ids.length ? await this.channelRepo.find({ where: { contact_id: In(ids) } as any }) : []
    return acs.map((ac) => ({
      application_id: ac.application_id,
      contact_id: ac.contact_id,
      role: ac.role,
      is_primary: ac.is_primary,
      contact: contacts.find((c) => c.id === ac.contact_id),
      channels: channels.filter((ch) => ch.contact_id === ac.contact_id),
    }))
  }

  async add(
    userId: string,
    appId: string,
    body: {
      contact_id?: string
      contact?: { name: string; title?: string | null; channels?: { medium: string; channel_value: string }[] }
      role: 'recruiter' | 'referrer' | 'hiring_manager' | 'interviewer' | 'other'
      is_primary?: boolean
    },
  ) {
    const app = await this.appRepo.findOne({ where: { id: appId, user_id: userId } })
    if (!app) throw new NotFoundException('Application not found')

    let contact: Contact | null = null
    if (body.contact_id) {
      contact = await this.contactRepo.findOne({ where: { id: body.contact_id } })
      if (!contact) throw new BadRequestException('Invalid contact_id')
    } else if (body.contact) {
      contact = await this.contactRepo.save(
        this.contactRepo.create({ name: body.contact.name, title: body.contact.title ?? null }),
      )
      if (body.contact.channels?.length) {
        for (const ch of body.contact.channels) {
          await this.channelRepo.save(
            this.channelRepo.create({ contact_id: contact.id, medium: ch.medium as any, channel_value: ch.channel_value }),
          )
        }
      }
    } else {
      throw new BadRequestException('contact_id or contact required')
    }

    const ac = this.appContactRepo.create({
      application_id: app.id,
      contact_id: contact.id,
      role: body.role,
      is_primary: !!body.is_primary,
    })
    await this.appContactRepo.save(ac)
    return ac
  }
}


