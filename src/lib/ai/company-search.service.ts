import { Injectable, Logger, Inject } from '@nestjs/common';
import { AIProvider, RateLimiter, LogoDownloader, CompanySearchResult } from './interfaces';

@Injectable()
export class CompanySearchService {
  private readonly logger = new Logger(CompanySearchService.name);

  constructor(
    @Inject('AI_PROVIDER') private readonly aiProvider: AIProvider,
    @Inject('RATE_LIMITER') private readonly rateLimiter: RateLimiter,
    @Inject('LOGO_DOWNLOADER') private readonly logoDownloader: LogoDownloader,
  ) {}

  async searchCompanies(query: string): Promise<CompanySearchResult[]> {
    // Validate input
    if (!query || query.trim().length < 4) {
      throw new Error('Query must be at least 4 characters long');
    }

    // Check rate limit
    const canProceed = await this.rateLimiter.canProceed();
    if (!canProceed) {
      throw new Error('Rate limit exceeded. Please try again later.');
    }

    try {
      // Record the request
      this.rateLimiter.recordRequest();

      // Search for companies using AI
      this.logger.log(`Searching for companies with query: "${query}"`);
      const response = await this.aiProvider.searchCompanies(query.trim());
      
      this.logger.log(`Raw AI response for query "${query}":`, JSON.stringify(response, null, 2));

      // Validate response structure
      if (!response || !response.companies || !Array.isArray(response.companies)) {
        this.logger.warn(`Invalid response structure for query "${query}":`, response);
        return [];
      }

      // Download logos for each company
      const companiesWithLogos = await Promise.all(
        response.companies.map(async (company) => {
          try {
            const logoBase64 = await this.logoDownloader.downloadLogo(company.domain);
            return {
              ...company,
              logoBase64,
            };
          } catch (error) {
            this.logger.warn(`Failed to download logo for ${company.domain}:`, error);
            return {
              ...company,
              logoBase64: null,
            };
          }
        })
      );

      this.logger.log(`Found ${companiesWithLogos.length} companies for query: "${query}"`);
      return companiesWithLogos;
    } catch (error) {
      this.logger.error(`Error searching companies for query "${query}":`, error);
      throw error;
    }
  }
}
