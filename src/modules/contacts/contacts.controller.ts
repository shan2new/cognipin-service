import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common'
import { ClerkGuard } from '../auth/clerk.guard'
import { ContactsService } from './contacts.service'
import { CurrentUser, RequestUser } from '../auth/current-user.decorator'

@UseGuards(ClerkGuard)
@Controller()
export class ContactsController {
  constructor(private readonly svc: ContactsService) {}

  // Application-scoped contacts
  @Get('v1/applications/:id/contacts')
  async list(@CurrentUser() _user: RequestUser, @Param('id') appId: string) {
    return this.svc.list(appId)
  }

  @Post('v1/applications/:id/contacts')
  async add(
    @CurrentUser() user: RequestUser,
    @Param('id') appId: string,
    @Body()
    body: {
      contact_id?: string
      contact?: { name: string; title?: string | null; channels?: { medium: string; channel_value: string }[] }
      role: 'recruiter' | 'referrer' | 'hiring_manager' | 'interviewer' | 'other'
      is_primary?: boolean
    },
  ) {
    return this.svc.add(user.userId, appId, body)
  }

  // Aggregated contacts for the current user
  @Get('v1/contacts')
  async listAll(@CurrentUser() user: RequestUser) {
    return this.svc.listAll(user.userId)
  }

  // Create a new contact (optionally link to an application with a role)
  @Post('v1/contacts')
  async create(
    @CurrentUser() user: RequestUser,
    @Body()
    body: {
      name: string
      title?: string | null
      notes?: string | null
      channels?: { medium: 'email' | 'linkedin' | 'phone' | 'whatsapp' | 'other'; channel_value: string }[]
      application_id?: string | null
      role?: 'recruiter' | 'referrer' | 'hiring_manager' | 'interviewer' | 'other' | null
    },
  ) {
    return this.svc.create(user.userId, body)
  }

  // Single contact (ensure user has access via their applications)
  @Get('v1/contacts/:id')
  async get(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.svc.getForUser(user.userId, id)
  }

  // Update contact fields
  @Post('v1/contacts/:id')
  async update(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() body: { name?: string; title?: string | null; notes?: string | null },
  ) {
    return this.svc.updateContact(user.userId, id, body)
  }

  // Manage contact channels
  @Post('v1/contacts/:id/channels')
  async addChannel(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() body: { medium: 'email' | 'linkedin' | 'phone' | 'whatsapp' | 'other'; channel_value: string },
  ) {
    return this.svc.addChannel(user.userId, id, body)
  }

  @Post('v1/contacts/:id/channels/:channelId')
  async updateChannel(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Param('channelId') channelId: string,
    @Body() body: { medium?: 'email' | 'linkedin' | 'phone' | 'whatsapp' | 'other'; channel_value?: string },
  ) {
    return this.svc.updateChannel(user.userId, id, channelId, body)
  }

  @Post('v1/contacts/:id/channels/:channelId/delete')
  async deleteChannel(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Param('channelId') channelId: string,
  ) {
    return this.svc.deleteChannel(user.userId, id, channelId)
  }
}


