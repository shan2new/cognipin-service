import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { In, Repository } from 'typeorm'
import { Application } from '../../schema/application.entity'
import { ApplicationContact } from '../../schema/application-contact.entity'
import { Contact } from '../../schema/contact.entity'
import { ContactChannel } from '../../schema/contact-channel.entity'
import { Company } from '../../schema/company.entity'

@Injectable()
export class ReferrersService {
  constructor(
    @InjectRepository(Application) private readonly appRepo: Repository<Application>,
    @InjectRepository(ApplicationContact) private readonly appContactRepo: Repository<ApplicationContact>,
    @InjectRepository(Contact) private readonly contactRepo: Repository<Contact>,
    @InjectRepository(ContactChannel) private readonly channelRepo: Repository<ContactChannel>,
    @InjectRepository(Company) private readonly companyRepo: Repository<Company>,
  ) {}

  async list(userId: string) {
    const apps = await this.appRepo.find({ where: { user_id: userId } })
    const appIds = apps.map((a) => a.id)
    if (appIds.length === 0) return []
    const acs = await this.appContactRepo.find({ where: { application_id: In(appIds), role: 'referrer' as any } })
    const contactIds = acs.map((a) => a.contact_id)
    const contacts = contactIds.length ? await this.contactRepo.findByIds(contactIds) : []
    const channels = contactIds.length ? await this.channelRepo.find({ where: { contact_id: In(contactIds) } as any }) : []
    const companyById = new Map<string, Company>()
    for (const app of apps) {
      if (!companyById.has(app.company_id)) {
        const comp = await this.companyRepo.findOne({ where: { id: app.company_id } })
        if (comp) companyById.set(app.company_id, comp)
      }
    }
    return acs.map((ac) => ({
      contact: contacts.find((c) => c.id === ac.contact_id),
      company: companyById.get(apps.find((a) => a.id === ac.application_id)?.company_id || ''),
      channels: channels.filter((ch) => ch.contact_id === ac.contact_id),
    }))
  }
}


