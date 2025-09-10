import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { In, Repository } from 'typeorm'
import { Application } from '../../schema/application.entity'
import { ApplicationContact } from '../../schema/application-contact.entity'
import { Contact } from '../../schema/contact.entity'
import { ContactChannel } from '../../schema/contact-channel.entity'
import { Company } from '../../schema/company.entity'
import { UserReferrer } from '../../schema/user-referrer.entity'
import { UserReferrerCompany } from '../../schema/user-referrer-company.entity'

@Injectable()
export class ReferrersService {
  constructor(
    @InjectRepository(Application) private readonly appRepo: Repository<Application>,
    @InjectRepository(ApplicationContact) private readonly appContactRepo: Repository<ApplicationContact>,
    @InjectRepository(Contact) private readonly contactRepo: Repository<Contact>,
    @InjectRepository(ContactChannel) private readonly channelRepo: Repository<ContactChannel>,
    @InjectRepository(Company) private readonly companyRepo: Repository<Company>,
    @InjectRepository(UserReferrer) private readonly userRefRepo: Repository<UserReferrer>,
    @InjectRepository(UserReferrerCompany) private readonly userRefCompanyRepo: Repository<UserReferrerCompany>,
  ) {}

  async list(userId: string) {
    // Combine: explicit user_referrer entries and inferred (application_contact role=referrer)
    const apps = await this.appRepo.find({ where: { user_id: userId } })
    const appIds = apps.map((a) => a.id)

    const explicit = await this.userRefRepo.find({ where: { user_id: userId } })
    const explicitCompanyLinks = explicit.length
      ? await this.userRefCompanyRepo.find({ where: { user_referrer_id: In(explicit.map((x) => x.id)) } as any })
      : []

    const inferred = appIds.length
      ? await this.appContactRepo.find({ where: { application_id: In(appIds), role: 'referrer' as any } })
      : []

    const contactIds = Array.from(new Set([...explicit.map((x) => x.contact_id), ...inferred.map((x) => x.contact_id)]))
    const contacts = contactIds.length ? await this.contactRepo.findBy({ id: In(contactIds) }) : []
    const channels = contactIds.length ? await this.channelRepo.find({ where: { contact_id: In(contactIds) } as any }) : []

    const companyIds = new Set<string>()
    for (const link of explicitCompanyLinks) companyIds.add(link.company_id)
    for (const a of apps) if (a.company_id) companyIds.add(a.company_id)
    const companies = companyIds.size ? await this.companyRepo.findBy({ id: In(Array.from(companyIds)) }) : []
    const companyById = new Map(companies.map((c) => [c.id, c]))

    // Build map of contact -> companies
    const explicitCompaniesByContact = new Map<string, Array<Company>>()
    for (const link of explicitCompanyLinks) {
      const ref = explicit.find((r) => r.id === link.user_referrer_id)
      if (!ref) continue
      const comp = companyById.get(link.company_id)
      if (!comp) continue
      const arr = explicitCompaniesByContact.get(ref.contact_id) || []
      arr.push(comp)
      explicitCompaniesByContact.set(ref.contact_id, arr)
    }

    // Apps-derived companies per contact (fallback)
    const appCompaniesByContact = new Map<string, Array<Company>>()
    for (const ac of inferred) {
      const app = apps.find((a) => a.id === ac.application_id)
      if (!app?.company_id) continue
      const comp = companyById.get(app.company_id)
      if (!comp) continue
      const arr = appCompaniesByContact.get(ac.contact_id) || []
      if (!arr.find((c) => c.id === comp.id)) arr.push(comp)
      appCompaniesByContact.set(ac.contact_id, arr)
    }

    return contactIds.map((cid) => {
      const contact = contacts.find((c) => c.id === cid) || null
      const ch = channels.filter((x) => x.contact_id === cid)
      const companies = explicitCompaniesByContact.get(cid) || appCompaniesByContact.get(cid) || []
      return { contact, company: companies[0] || null, companies, channels: ch }
    })
  }

  async create(
    userId: string,
    body: {
      name: string
      title?: string | null
      channels?: Array<{ medium: 'email' | 'linkedin' | 'phone' | 'whatsapp' | 'other'; channel_value: string }>
      company_ids?: Array<string>
    },
  ) {
    if (!body?.name?.trim()) throw new Error('name required')
    const contact = await this.contactRepo.save(this.contactRepo.create({ name: body.name.trim(), title: body.title ?? null }))
    if (body.channels?.length) {
      for (const ch of body.channels) {
        if (!ch.channel_value?.trim()) continue
        await this.channelRepo.save(this.channelRepo.create({ contact_id: contact.id, medium: ch.medium, channel_value: ch.channel_value.trim() }))
      }
    }
    const ref = await this.userRefRepo.save(this.userRefRepo.create({ user_id: userId, contact_id: contact.id }))
    if (Array.isArray(body.company_ids) && body.company_ids.length) {
      for (const company_id of body.company_ids) {
        await this.userRefCompanyRepo.save(this.userRefCompanyRepo.create({ user_referrer_id: ref.id, company_id }))
      }
    }
    return { id: contact.id }
  }
}


