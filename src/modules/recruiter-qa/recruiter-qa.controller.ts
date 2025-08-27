import { Body, Controller, Get, Post, Put, UseGuards } from '@nestjs/common'
import { ClerkGuard } from '../auth/clerk.guard'
import { CurrentUser, RequestUser } from '../auth/current-user.decorator'
import { RecruiterQAService } from './recruiter-qa.service'
import { ApplicationsQARehearsalService } from '../applications/applications.qa-rehearsal.service'
import { RedisService } from '../../lib/redis.service'

@UseGuards(ClerkGuard)
@Controller('v1/recruiter-qa')
export class RecruiterQAController {
  constructor(
    private readonly svc: RecruiterQAService,
    private readonly qaRehearsal: ApplicationsQARehearsalService,
    private readonly redis: RedisService,
  ) {}

  @Get()
  async list(@CurrentUser() user: RequestUser) {
    return this.svc.list(user.userId)
  }

  @Put()
  async put(
    @CurrentUser() user: RequestUser,
    @Body()
    body: {
      current_ctc_text?: string
      expected_ctc_text?: string
      notice_period_text?: string
      reason_leaving_current_text?: string
      past_leaving_reasons_text?: string
    },
  ) {
    return this.svc.put(user.userId, body)
  }

  @Post('rehearsal')
  async generateRehearsal(@CurrentUser() user: RequestUser) {
    const cacheKey = `qa_rehearsal:${user.userId}:latest`
    
    // Try to get from cache first
    const cached = await this.redis.get(cacheKey)
    if (cached) {
      try {
        return JSON.parse(cached)
      } catch (error) {
        console.error('Failed to parse cached QA rehearsal:', error)
      }
    }
    
    const qaData = await this.svc.list(user.userId)
    
    // Check if we have any QA data
    const hasData = Object.values(qaData).some(value => value && value.trim())
    if (!hasData) {
      const response = { note: 'No QA data available. Add your responses in Profile settings.' }
      // Cache the response with forever TTL
      await this.redis.set(cacheKey, JSON.stringify(response))
      return response
    }
    
    const response = await this.qaRehearsal.generateRehearsalResponses(qaData)
    
    // Cache the response with forever TTL
    await this.redis.set(cacheKey, JSON.stringify(response))
    
    return response
  }

  @Post('rehearsal/clear-cache')
  async clearRehearsalCache(@CurrentUser() user: RequestUser) {
    const cacheKey = `qa_rehearsal:${user.userId}:latest`
    await this.redis.del(cacheKey)
    return { message: 'QA rehearsal cache cleared successfully' }
  }
}


