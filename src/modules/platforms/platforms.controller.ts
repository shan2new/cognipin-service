import { Body, Controller, Get, Post, UseGuards, HttpException, HttpStatus } from '@nestjs/common'
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

  @Post('search')
  async searchAndUpsert(@Body() body: { query: string }) {
    if (!body.query || body.query.trim().length < 4) {
      throw new HttpException('Query must be at least 4 characters long', HttpStatus.BAD_REQUEST)
    }

    try {
      return await this.svc.searchAndUpsert(body.query.trim())
    } catch (error: any) {
      if (error?.message?.includes('Rate limit exceeded')) {
        throw new HttpException('Rate limit exceeded. Please try again later.', HttpStatus.TOO_MANY_REQUESTS)
      }
      throw new HttpException(error?.message || 'Internal server error', HttpStatus.INTERNAL_SERVER_ERROR)
    }
  }
}


