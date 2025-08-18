import { Injectable, Logger, Inject } from '@nestjs/common'
import { AIProvider, RateLimiter, RoleSuggestionContext, RoleSuggestionResponse } from './interfaces'
import { Company } from '../../schema/company.entity'

interface UserContextInput {
  currentRole?: string | null
  currentCompany?: string | null
}

interface CacheEntry {
  expiresAt: number
  data: RoleSuggestionResponse
}

@Injectable()
export class RoleSuggestionService {
  private readonly logger = new Logger(RoleSuggestionService.name)
  private readonly cache = new Map<string, CacheEntry>()
  private readonly ttlMs = 10 * 60 * 1000 // 10 minutes

  constructor(
    @Inject('AI_PROVIDER') private readonly aiProvider: AIProvider,
    @Inject('RATE_LIMITER') private readonly rateLimiter: RateLimiter,
  ) {}

  async suggestRoles(company: Company, user: UserContextInput): Promise<RoleSuggestionResponse> {
    const key = this.cacheKey(company, user)

    // Serve from cache
    const cached = this.cache.get(key)
    const now = Date.now()
    if (cached && cached.expiresAt > now) {
      this.logger.debug(`Cache hit for role suggestions key=${key}`)
      return cached.data
    }

    // Rate limit
    const canProceed = await this.rateLimiter.canProceed()
    if (!canProceed) {
      throw new Error('Rate limit exceeded. Please try again later.')
    }

    try {
      this.rateLimiter.recordRequest()
      const context: RoleSuggestionContext = {
        company: {
          name: company.name,
          domain: company.domain ?? undefined,
          industries: company.industries ?? undefined,
          description: company.description ?? undefined,
          hq: company.hq ?? undefined,
          employeeCount: company.employee_count ?? undefined,
        },
        user: {
          currentRole: user.currentRole ?? undefined,
          currentCompany: user.currentCompany ?? undefined,
        },
      }

      this.logger.log(`Requesting AI role suggestions for company=${company.id} (${company.name})`)
      const response = await this.aiProvider.suggestRoles(context)

      // Validate structure
      if (!response || !Array.isArray(response.suggestions)) {
        this.logger.warn(`Invalid role suggestion response for company=${company.id}: ${JSON.stringify(response)}`)
        return { suggestions: [] }
      }

      // Cache result
      this.cache.set(key, { expiresAt: now + this.ttlMs, data: response })
      return response
    } catch (err) {
      this.logger.error(`Error suggesting roles for company=${company.id}:`, err as any)
      throw err
    }
  }

  private cacheKey(company: Company, user: UserContextInput): string {
    const u = `${user.currentRole || ''}|${user.currentCompany || ''}`
    return `${company.id}|${u}`
  }
}
