import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common'
import { ClerkGuard } from '../auth/clerk.guard'
import { CurrentUser, RequestUser } from '../auth/current-user.decorator'
import { ProfileService } from './profile.service'

@UseGuards(ClerkGuard)
@Controller('v1/profile')
export class ProfileController {
  constructor(private readonly svc: ProfileService) {}

  @Get()
  async get(@CurrentUser() user: RequestUser) {
    return this.svc.get(user.userId)
  }

  @Patch()
  async update(
    @CurrentUser() user: RequestUser,
    @Body()
    body: {
      notice_period_days?: number | null
      earliest_join_date?: string | null
      theme?: 'light' | 'dark' | null
      current_role?: string | null
      current_company?: string | null
      current_company_id?: string | null
      persona?: 'student' | 'intern' | 'professional' | null
      persona_info?: any | null
      linkedin_url?: string | null
    },
  ) {
    return this.svc.update(user.userId, body)
  }

}


