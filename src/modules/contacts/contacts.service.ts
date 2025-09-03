import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { In, Repository } from 'typeorm'
import { Application } from '../../schema/application.entity'
import { ApplicationContact } from '../../schema/application-contact.entity'
import { Contact } from '../../schema/contact.entity'
import { ContactChannel } from '../../schema/contact-channel.entity'
import { Company } from '../../schema/company.entity'
import { Platform } from '../../schema/platform.entity'

@Injectable()
export class ContactsService {
  constructor(
    @InjectRepository(Application) private readonly appRepo: Repository<Application>,
    @InjectRepository(Contact) private readonly contactRepo: Repository<Contact>,
    @InjectRepository(ContactChannel) private readonly channelRepo: Repository<ContactChannel>,
    @InjectRepository(ApplicationContact) private readonly appContactRepo: Repository<ApplicationContact>,
    @InjectRepository(Company) private readonly companyRepo: Repository<Company>,
    @InjectRepository(Platform) private readonly platformRepo: Repository<Platform>,
  ) {}

  async list(appId: string) {
    const acs = await this.appContactRepo.find({ where: { application_id: appId } })
    const ids = acs.map((x) => x.contact_id)
    const contacts = ids.length ? await this.contactRepo.findBy({ id: In(ids) }) : []
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

  async create(
    userId: string,
    body: {
      name: string
      title?: string | null
      notes?: string | null
      channels?: { medium: ContactChannel['medium']; channel_value: string }[]
      application_id?: string | null
      role?: ApplicationContact['role'] | null
    },
  ) {
    if (!body?.name || !body.name.trim()) throw new BadRequestException('name required')
    // If application provided, ensure it belongs to user
    let app: Application | null = null
    if (body.application_id) {
      app = await this.appRepo.findOne({ where: { id: body.application_id, user_id: userId } })
      if (!app) throw new NotFoundException('Application not found')
    }
    const c = await this.contactRepo.save(
      this.contactRepo.create({ name: body.name.trim(), title: body.title ?? null, notes: body.notes ?? null }),
    )
    if (Array.isArray(body.channels)) {
      for (const ch of body.channels) {
        if (!ch?.channel_value) continue
        await this.channelRepo.save(
          this.channelRepo.create({ contact_id: c.id, medium: ch.medium, channel_value: ch.channel_value }),
        )
      }
    }
    if (app && body.role) {
      await this.appContactRepo.save(
        this.appContactRepo.create({ application_id: app.id, contact_id: c.id, role: body.role, is_primary: false }),
      )
    }
    return { id: c.id }
  }

  /**
   * List all contacts associated with the current user's applications.
   * Aggregates roles, companies, channels, and platforms across applications.
   */
  async listAll(userId: string) {
    const apps = await this.appRepo.find({ where: { user_id: userId } })
    const appIds = apps.map((a) => a.id)
    if (appIds.length === 0) return []

    const appContacts = await this.appContactRepo.find({ where: { application_id: In(appIds) } })
    const contactIds = Array.from(new Set(appContacts.map((a) => a.contact_id)))

    const [contacts, channels] = await Promise.all([
      contactIds.length ? this.contactRepo.findBy({ id: In(contactIds) }) : Promise.resolve([]),
      contactIds.length ? this.channelRepo.find({ where: { contact_id: In(contactIds) } as any }) : Promise.resolve([]),
    ])

    // Build maps for faster lookup
    const appsById = new Map<string, Application>()
    for (const a of apps) appsById.set(a.id, a)

    // Collect company and platform ids we need
    const companyIds = new Set<string>()
    const platformIds = new Set<string>()
    for (const ac of appContacts) {
      const a = appsById.get(ac.application_id)
      if (!a) continue
      if (a.company_id) companyIds.add(a.company_id)
      if (a.platform_id) platformIds.add(a.platform_id)
    }

    // Fetch referenced companies and platforms
    const [companies, platforms] = await Promise.all([
      companyIds.size ? this.companyRepo.findBy({ id: In(Array.from(companyIds)) }) : Promise.resolve([]),
      platformIds.size ? this.platformRepo.findBy({ id: In(Array.from(platformIds)) }) : Promise.resolve([]),
    ])
    const companyById = new Map(companies.map((c) => [c.id, c]))
    const platformById = new Map(platforms.map((p) => [p.id, p]))

    // Group application contacts by contact_id
    const grouped = new Map<string, Array<ApplicationContact>>()
    for (const ac of appContacts) {
      if (!grouped.has(ac.contact_id)) grouped.set(ac.contact_id, [])
      grouped.get(ac.contact_id)!.push(ac)
    }

    // Build aggregate rows
    const result = Array.from(grouped.entries()).map(([contactId, acs]) => {
      const contact = contacts.find((c) => c.id === contactId) || null
      const contactChannels = channels.filter((ch) => ch.contact_id === contactId)

      const roles = Array.from(new Set(acs.map((x) => x.role)))

      const usedAppIds = new Set(acs.map((x) => x.application_id))
      const usedCompanies = new Map<string, Company>()
      const usedPlatforms = new Map<string, Platform>()
      for (const appId of usedAppIds) {
        const a = appsById.get(appId)
        if (!a) continue
        if (a.company_id && companyById.has(a.company_id)) {
          usedCompanies.set(a.company_id, companyById.get(a.company_id)!)
        }
        if (a.platform_id && platformById.has(a.platform_id)) {
          usedPlatforms.set(a.platform_id, platformById.get(a.platform_id)!)
        }
      }

      return {
        contact: contact ? { id: contact.id, name: contact.name, title: contact.title } : { id: contactId, name: 'Unknown', title: null },
        channels: contactChannels.map((ch) => ({ medium: ch.medium, channel_value: ch.channel_value })),
        roles,
        companies: Array.from(usedCompanies.values()).map((c) => ({ id: c.id, name: c.name, logo_url: (c as any).logo_url || null })),
        platforms: Array.from(usedPlatforms.values()).map((p) => ({ id: p.id, name: p.name, logo_url: (p as any).logo_url || null })),
        applications_count: usedAppIds.size,
      }
    })

    // Sort by most recently used via application created_at? App entity has created_at, but we did not fetch join.
    // For now sort by name asc
    result.sort((a, b) => (a.contact.name || '').localeCompare(b.contact.name || ''))
    return result
  }

  private async assertContactEditableByUser(userId: string, contactId: string) {
    // Contact is editable if it is linked to at least one of the user's applications
    const apps = await this.appRepo.find({ where: { user_id: userId } })
    const appIds = apps.map((a) => a.id)
    if (appIds.length === 0) throw new NotFoundException('Contact not found')
    const link = await this.appContactRepo.findOne({ where: { contact_id: contactId, application_id: In(appIds) } as any })
    if (!link) throw new NotFoundException('Contact not found')
  }

  async getForUser(userId: string, id: string) {
    await this.assertContactEditableByUser(userId, id)
    const contact = await this.contactRepo.findOne({ where: { id } })
    if (!contact) throw new NotFoundException('Contact not found')
    const channels = await this.channelRepo.find({ where: { contact_id: id } as any })
    return { contact, channels }
  }

  async updateContact(
    userId: string,
    id: string,
    body: { name?: string; title?: string | null; notes?: string | null },
  ) {
    await this.assertContactEditableByUser(userId, id)
    const contact = await this.contactRepo.findOne({ where: { id } })
    if (!contact) throw new NotFoundException('Contact not found')
    if (typeof body.name === 'string') contact.name = body.name
    if (typeof body.title !== 'undefined') contact.title = body.title
    if (typeof body.notes !== 'undefined') contact.notes = body.notes
    await this.contactRepo.save(contact)
    return contact
  }

  async addChannel(
    userId: string,
    id: string,
    body: { medium: ContactChannel['medium']; channel_value: string },
  ) {
    await this.assertContactEditableByUser(userId, id)
    if (!body?.medium || !body?.channel_value) throw new BadRequestException('medium and channel_value required')
    const ch = this.channelRepo.create({ contact_id: id, medium: body.medium, channel_value: body.channel_value })
    return this.channelRepo.save(ch)
  }

  async updateChannel(
    userId: string,
    id: string,
    channelId: string,
    body: { medium?: ContactChannel['medium']; channel_value?: string },
  ) {
    await this.assertContactEditableByUser(userId, id)
    const ch = await this.channelRepo.findOne({ where: { id: channelId, contact_id: id } as any })
    if (!ch) throw new NotFoundException('Channel not found')
    if (typeof body.medium !== 'undefined') ch.medium = body.medium!
    if (typeof body.channel_value !== 'undefined') ch.channel_value = body.channel_value!
    return this.channelRepo.save(ch)
  }

  async deleteChannel(userId: string, id: string, channelId: string) {
    await this.assertContactEditableByUser(userId, id)
    const ch = await this.channelRepo.findOne({ where: { id: channelId, contact_id: id } as any })
    if (!ch) throw new NotFoundException('Channel not found')
    await this.channelRepo.delete(ch.id)
    return { success: true }
  }
}


