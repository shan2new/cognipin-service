import { Body, Controller, Get, Param, Post, Query, UseGuards, HttpException, HttpStatus } from '@nestjs/common'
import { ClerkGuard } from '../auth/clerk.guard'
import { CompaniesService } from './companies.service'
import { RoleSuggestionService } from '../../lib/ai/role-suggestion.service'
import { CurrentUser, RequestUser } from '../auth/current-user.decorator'
import { ProfileService } from '../profile/profile.service'

@UseGuards(ClerkGuard)
@Controller('v1/companies')
export class CompaniesController {
  constructor(
    private readonly svc: CompaniesService,
    private readonly roleSvc: RoleSuggestionService,
    private readonly profileSvc: ProfileService,
  ) {}

  @Get()
  async list(@Query('search') search?: string) {
    return this.svc.list(search)
  }

  @Post()
  async create(@Body() body: { website_url: string }) {
    return this.svc.upsertByWebsite(body.website_url)
  }

  @Post('search')
  async searchAndUpsert(@Body() body: { query: string }) {
    if (!body.query || body.query.trim().length < 4) {
      throw new HttpException(
        'Query must be at least 4 characters long',
        HttpStatus.BAD_REQUEST
      );
    }

    try {
      return await this.svc.searchAndUpsert(body.query.trim());
    } catch (error: any) {
      if (error?.message?.includes('Rate limit exceeded')) {
        throw new HttpException(
          'Rate limit exceeded. Please try again later.',
          HttpStatus.TOO_MANY_REQUESTS
        );
      }
      throw new HttpException(
        error?.message || 'Internal server error',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Get(':id')
  async getById(@Param('id') id: string) {
    return this.svc.getById(id)
  }

  @Post(':id/role-suggestions')
  async suggestRoles(
    @Param('id') id: string,
    @CurrentUser() user: RequestUser,
    @Body() body?: { current_role?: string | null; current_company?: string | null },
  ) {
    try {
      const company = await this.svc.getById(id)
      if (!company) {
        throw new HttpException('Company not found', HttpStatus.NOT_FOUND)
      }

      const profile = await this.profileSvc.get(user.userId)
      const userCtx = {
        currentRole: body?.current_role ?? (profile as any)?.current_role ?? null,
        currentCompany: body?.current_company ?? (profile as any)?.current_company ?? null,
      }

      return await this.roleSvc.suggestRoles(company, userCtx)
    } catch (error: any) {
      if (error?.message?.includes('Rate limit exceeded')) {
        throw new HttpException(
          'Rate limit exceeded. Please try again later.',
          HttpStatus.TOO_MANY_REQUESTS,
        )
      }
      throw new HttpException(
        error?.message || 'Internal server error',
        HttpStatus.INTERNAL_SERVER_ERROR,
      )
    }
  }
}


