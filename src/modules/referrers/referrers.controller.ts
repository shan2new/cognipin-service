import { Controller, Get, UseGuards } from '@nestjs/common'
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
}


