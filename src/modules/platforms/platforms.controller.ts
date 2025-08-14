import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common'
import { ClerkGuard } from '../auth/clerk.guard'
import { PlatformsService } from './platforms.service'

@UseGuards(ClerkGuard)
@Controller('v1/platforms')
export class PlatformsController {
  constructor(private readonly svc: PlatformsService) {}

  @Get()
  async list() {
    return this.svc.list()
  }

  @Post()
  async upsert(@Body() body: { name: string; url: string }) {
    return this.svc.upsert(body.name, body.url)
  }
}


