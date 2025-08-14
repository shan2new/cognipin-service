import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common'
import { ClerkGuard } from '../auth/clerk.guard'
import { CurrentUser, RequestUser } from '../auth/current-user.decorator'
import { ConversationsService } from './conversations.service'

@UseGuards(ClerkGuard)
@Controller('v1/applications/:id/conversations')
export class ConversationsController {
  constructor(private readonly svc: ConversationsService) {}

  @Get()
  async list(
    @CurrentUser() user: RequestUser,
    @Param('id') appId: string,
    @Query('limit') limit?: string,
    @Query('before') before?: string,
  ) {
    return this.svc.list(user.userId, appId, { limit: limit ? Number(limit) : undefined, before })
  }

  @Post()
  async add(
    @CurrentUser() user: RequestUser,
    @Param('id') appId: string,
    @Body() body: { contact_id?: string; medium: string; direction: string; text: string; occurred_at?: string },
  ) {
    return this.svc.add(user.userId, appId, body)
  }
}


