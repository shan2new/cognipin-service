import { Injectable, Logger, Inject } from '@nestjs/common'
import { AIProvider, RateLimiter, LogoDownloader, CompanySearchResult } from './interfaces'

@Injectable()
export class PlatformSearchService {
  private readonly logger = new Logger(PlatformSearchService.name)

  constructor(
    @Inject('AI_PROVIDER') private readonly aiProvider: AIProvider,
    @Inject('RATE_LIMITER') private readonly rateLimiter: RateLimiter,
    @Inject('LOGO_DOWNLOADER') private readonly logoDownloader: LogoDownloader,
  ) {}

  async searchPlatforms(query: string): Promise<(CompanySearchResult & { logoBase64?: string | null })[]> {
    if (!query || query.trim().length < 4) {
      throw new Error('Query must be at least 4 characters long')
    }

    const canProceed = await this.rateLimiter.canProceed()
    if (!canProceed) {
      throw new Error('Rate limit exceeded. Please try again later.')
    }

    try {
      // Record the request now that we're proceeding
      this.rateLimiter.recordRequest()

      this.logger.log(`Searching for platforms with query: "${query}"`)
      // Reuse company search for platform discovery
      const response = await this.aiProvider.searchCompanies(query.trim())

      if (!response || !response.companies || !Array.isArray(response.companies)) {
        this.logger.warn(`Invalid response structure for query "${query}":`, response as any)
        return []
      }

      // Enrich with logos
      const enriched = await Promise.all(
        response.companies.map(async (item) => {
          try {
            const logoBase64 = await this.logoDownloader.downloadLogo(item.domain)
            return { ...item, logoBase64 }
          } catch (err) {
            this.logger.warn(`Failed to download logo for ${item.domain}:`, err as any)
            return { ...item, logoBase64: null }
          }
        }),
      )

      this.logger.log(`Found ${enriched.length} platform candidates for query: "${query}"`)
      return enriched
    } catch (error) {
      this.logger.error(`Error searching platforms for query "${query}":`, error as any)
      throw error
    }
  }
}
