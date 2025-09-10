import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common'
import { ClerkGuard } from '../auth/clerk.guard'
import { CurrentUser, RequestUser } from '../auth/current-user.decorator'
import { ReferrersService } from './referrers.service'

@UseGuards(ClerkGuard)
@Controller('v1/referrers')
export class ReferrersController {
  constructor(private readonly svc: ReferrersService) {}

  @Get()
  async list(@CurrentUser() user: RequestUser) {
    return this.svc.list(user.userId)
  }

  @Post()
  async create(
    @CurrentUser() user: RequestUser,
    @Body()
    body: {
      name: string
      title?: string | null
      channels?: Array<{ medium: 'email' | 'linkedin' | 'phone' | 'whatsapp' | 'other'; channel_value: string }>
      company_ids?: Array<string>
    },
  ) {
    return this.svc.create(user.userId, body)
  }
}


