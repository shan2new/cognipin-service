import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common'
import { ClerkGuard } from '../auth/clerk.guard'
import { ContactsService } from './contacts.service'
import { CurrentUser, RequestUser } from '../auth/current-user.decorator'

@UseGuards(ClerkGuard)
@Controller('v1/applications/:id/contacts')
export class ContactsController {
  constructor(private readonly svc: ContactsService) {}

  @Get()
  async list(@CurrentUser() _user: RequestUser, @Param('id') appId: string) {
    return this.svc.list(appId)
  }

  @Post()
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
}


