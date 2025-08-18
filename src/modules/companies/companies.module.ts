import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { Company } from '../../schema/company.entity'
import { CompaniesController } from './companies.controller'
import { CompaniesService } from './companies.service'
import { CompanySearchService } from '../../lib/ai/company-search.service'
import { HybridFallbackProvider } from '../../lib/ai/hybrid-fallback-provider'
import { TokenBucketRateLimiter } from '../../lib/ai/rate-limiter'
import { ClearbitLogoDownloader } from '../../lib/ai/logo-downloader'

@Module({
  imports: [TypeOrmModule.forFeature([Company]), ConfigModule],
  controllers: [CompaniesController],
  providers: [
    CompaniesService,
    CompanySearchService,
    {
      provide: 'AI_PROVIDER',
      useFactory: (configService: ConfigService) => {
        const openRouterApiKey = configService.get<string>('OPENROUTER_API_KEY');
        const tavilyApiKey = configService.get<string>('TAVILY_API_KEY');
        
        if (!openRouterApiKey) {
          throw new Error('OPENROUTER_API_KEY environment variable is required');
        }
        if (!tavilyApiKey) {
          throw new Error('TAVILY_API_KEY environment variable is required');
        }
        
        return new HybridFallbackProvider(openRouterApiKey, tavilyApiKey);
      },
      inject: [ConfigService],
    },
    {
      provide: 'RATE_LIMITER',
      useFactory: () => {
        // Configure rate limiter: 10 requests per minute
        return new TokenBucketRateLimiter(10, 10 / 60);
      },
    },
    {
      provide: 'LOGO_DOWNLOADER',
      useClass: ClearbitLogoDownloader,
    },
  ],
  exports: [CompaniesService],
})
export class CompaniesModule {}


