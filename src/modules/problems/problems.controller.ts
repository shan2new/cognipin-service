import { Controller, Get, Query, UseGuards } from '@nestjs/common'
import { ProblemsService } from './problems.service'
import { ClerkGuard } from '../auth/clerk.guard'
import { CurrentUser, RequestUser } from '../auth/current-user.decorator'

@UseGuards(ClerkGuard)
@Controller('problems')
export class ProblemsController {
  constructor(private readonly service: ProblemsService) {}

  @Get()
  async findAll(
    @CurrentUser() user: RequestUser,
    @Query('q') q?: string,
    @Query('difficulty') difficulty?: 'Easy' | 'Medium' | 'Hard',
    @Query('topics') topicsCsv?: string,
    @Query('status') status?: 'Not Started' | 'Attempted' | 'Solved',
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const topics = topicsCsv ? topicsCsv.split(',').map((s) => s.trim()).filter(Boolean) : []
    return this.service.findAll({ userId: user.userId, q, difficulty, topics, status, page: page ? Number(page) : undefined, limit: limit ? Number(limit) : undefined })
  }

  @Get('difficulty-counts')
  async difficultyCounts(
    @CurrentUser() user: RequestUser,
    @Query('q') q?: string,
    @Query('topics') topicsCsv?: string,
    @Query('status') status?: 'Not Started' | 'Attempted' | 'Solved',
  ) {
    const topics = topicsCsv ? topicsCsv.split(',').map((s) => s.trim()).filter(Boolean) : []
    return this.service.getDifficultyCounts({ userId: user.userId, q, topics, status })
  }
}


