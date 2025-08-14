import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common'
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

  @Get(':id')
  async getById(@Param('id') id: string) {
    return this.svc.getById(id)
  }
}


