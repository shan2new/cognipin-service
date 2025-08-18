import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { Platform } from '../../schema/platform.entity'
import { PlatformsController } from './platforms.controller'
import { PlatformsService } from './platforms.service'
import { PlatformSearchService } from '../../lib/ai/platform-search.service'
import { HybridFallbackProvider } from '../../lib/ai/hybrid-fallback-provider'
import { TokenBucketRateLimiter } from '../../lib/ai/rate-limiter'
import { ClearbitLogoDownloader } from '../../lib/ai/logo-downloader'

@Module({
  imports: [TypeOrmModule.forFeature([Platform]), ConfigModule],
  controllers: [PlatformsController],
  providers: [
    PlatformsService,
    PlatformSearchService,
    {
      provide: 'AI_PROVIDER',
      useFactory: (configService: ConfigService) => {
        const openRouterApiKey = configService.get<string>('OPENROUTER_API_KEY')
        const tavilyApiKey = configService.get<string>('TAVILY_API_KEY')
        if (!openRouterApiKey) {
          throw new Error('OPENROUTER_API_KEY environment variable is required')
        }
        if (!tavilyApiKey) {
          throw new Error('TAVILY_API_KEY environment variable is required')
        }
        return new HybridFallbackProvider(openRouterApiKey, tavilyApiKey)
      },
      inject: [ConfigService],
    },
    {
      provide: 'RATE_LIMITER',
      useFactory: () => new TokenBucketRateLimiter(10, 10 / 60),
    },
    {
      provide: 'LOGO_DOWNLOADER',
      useClass: ClearbitLogoDownloader,
    },
  ],
  exports: [PlatformsService],
})
export class PlatformsModule {}


