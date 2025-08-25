import { Controller, Get, Query, UseGuards, HttpException, HttpStatus } from '@nestjs/common'
import { RolesService } from './roles.service'
import { ClerkGuard } from '../auth/clerk.guard'
import { CurrentUser, RequestUser } from '../auth/current-user.decorator'

@UseGuards(ClerkGuard)
@Controller('v1/roles')
export class RolesController {
  constructor(private readonly roles: RolesService) {}

  @Get('search')
  async search(
    @CurrentUser() user: RequestUser,
    @Query('q') q?: string,
    @Query('limit') limitStr?: string,
  ) {
    const query = (q || '').trim()
    if (!query || query.length < 2) {
      throw new HttpException('Query must be at least 2 characters long', HttpStatus.BAD_REQUEST)
    }
    const limit = Math.min(Math.max(parseInt(limitStr || '20', 10) || 20, 1), 50)
    return this.roles.search(user.userId, query, limit)
  }
}
