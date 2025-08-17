import { Body, Controller, Get, Param, Post, Query, UseGuards, HttpException, HttpStatus } from '@nestjs/common'
import { ClerkGuard } from '../auth/clerk.guard'
import { CompaniesService } from './companies.service'

@UseGuards(ClerkGuard)
@Controller('v1/companies')
export class CompaniesController {
  constructor(private readonly svc: CompaniesService) {}

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
}


