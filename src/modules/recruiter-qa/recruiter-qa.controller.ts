import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common'
import { ClerkGuard } from '../auth/clerk.guard'
import { CurrentUser, RequestUser } from '../auth/current-user.decorator'
import { RecruiterQAService } from './recruiter-qa.service'

@UseGuards(ClerkGuard)
@Controller('v1/recruiter-qa')
export class RecruiterQAController {
  constructor(private readonly svc: RecruiterQAService) {}

  @Get()
  async list(@CurrentUser() user: RequestUser) {
    return this.svc.list(user.userId)
  }

  @Put()
  async put(
    @CurrentUser() user: RequestUser,
    @Body()
    body: {
      current_ctc_text?: string
      expected_ctc_text?: string
      notice_period_text?: string
      reason_leaving_current_text?: string
      past_leaving_reasons_text?: string
    },
  ) {
    return this.svc.put(user.userId, body)
  }
}


