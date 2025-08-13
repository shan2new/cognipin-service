import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common'
import { ProgressService } from './progress.service'
import { ClerkGuard } from '../auth/clerk.guard'
import { CurrentUser, RequestUser } from '../auth/current-user.decorator'
import { IsIn, IsNotEmpty } from 'class-validator'

class UpdateStatusDto {
  @IsNotEmpty()
  @IsIn(['Not Started', 'Attempted', 'Solved'])
  status!: 'Not Started' | 'Attempted' | 'Solved'
}

@UseGuards(ClerkGuard)
@Controller('progress')
export class ProgressController {
  constructor(private readonly service: ProgressService) {}

  @Patch(':problemId')
  async updateStatus(
    @CurrentUser() user: RequestUser,
    @Param('problemId') problemId: string,
    @Body() dto: UpdateStatusDto
  ) {
    await this.service.upsertStatus(user.userId, problemId, dto.status)
    const counts = await this.service.getStatusCounts(user.userId)
    return { ok: true, counts }
  }

  @Get('overall')
  async overall(@CurrentUser() user: RequestUser) {
    return this.service.getOverall(user.userId)
  }

  @Get('topics')
  async byTopic(@CurrentUser() user: RequestUser) {
    return this.service.getByTopic(user.userId)
  }

  @Get('status-counts')
  async statusCounts(@CurrentUser() user: RequestUser) {
    return this.service.getStatusCounts(user.userId)
  }
}


