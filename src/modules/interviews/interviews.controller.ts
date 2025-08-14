import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common'
import { ClerkGuard } from '../auth/clerk.guard'
import { CurrentUser, RequestUser } from '../auth/current-user.decorator'
import { InterviewsService } from './interviews.service'

@UseGuards(ClerkGuard)
@Controller('v1/applications/:id/interviews')
export class InterviewsController {
  constructor(private readonly svc: InterviewsService) {}

  @Get()
  async list(@CurrentUser() user: RequestUser, @Param('id') appId: string) {
    return this.svc.list(user.userId, appId)
  }

  @Post()
  async schedule(
    @CurrentUser() user: RequestUser,
    @Param('id') appId: string,
    @Body() body: { type: string; scheduled_at: string; mode: string },
  ) {
    return this.svc.schedule(user.userId, appId, body)
  }

  @Post(':roundId/reschedule')
  async reschedule(
    @CurrentUser() user: RequestUser,
    @Param('id') appId: string,
    @Param('roundId') roundId: string,
    @Body() body: { scheduled_at: string },
  ) {
    return this.svc.reschedule(user.userId, appId, roundId, body)
  }

  @Post(':roundId/complete')
  async complete(
    @CurrentUser() user: RequestUser,
    @Param('id') appId: string,
    @Param('roundId') roundId: string,
    @Body() body: { started_at?: string; completed_at: string; result: string; feedback?: string },
  ) {
    return this.svc.complete(user.userId, appId, roundId, body)
  }
}


