import { Controller, Get, Query, UseGuards } from '@nestjs/common'
import { ClerkGuard } from '../auth/clerk.guard'
import { CurrentUser, RequestUser } from '../auth/current-user.decorator'
import { AnalyticsService } from './analytics.service'

@UseGuards(ClerkGuard)
@Controller('v1/analytics')
export class AnalyticsController {
  constructor(private readonly svc: AnalyticsService) {}

  @Get('funnel')
  async funnel(@CurrentUser() user: RequestUser, @Query('window_start') ws?: string, @Query('window_end') we?: string) {
    return this.svc.funnel(user.userId, ws, we)
  }

  @Get('aging')
  async aging(
    @CurrentUser() user: RequestUser,
    @Query('stage') stage?: string,
    @Query('gt_days') gtDays?: string,
    @Query('window_start') ws?: string,
    @Query('window_end') we?: string,
  ) {
    return this.svc.aging(user.userId, { stage, gtDays: gtDays ? Number(gtDays) : undefined, ws, we })
  }

  @Get('platforms')
  async platforms(@CurrentUser() user: RequestUser, @Query('window_start') ws?: string, @Query('window_end') we?: string) {
    return this.svc.platforms(user.userId, ws, we)
  }
}


