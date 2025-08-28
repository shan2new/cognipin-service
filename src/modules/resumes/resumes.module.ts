import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { Resume } from '../../schema/resume.entity'
import { ResumesService } from './resumes.service'
import { ResumesController } from './resumes.controller'
import { ResumesAiService } from './resumes.ai.service'
import { ResumesExportService } from './resumes.export.service'
import { ResumesParseService } from './resumes.parse.service'
import { ProfileModule } from '../profile/profile.module'
import { RedisService } from '../../lib/redis.service'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { HybridFallbackProvider } from '../../lib/ai/hybrid-fallback-provider'

@Module({
  imports: [TypeOrmModule.forFeature([Resume]), ProfileModule, ConfigModule],
  controllers: [ResumesController],
  providers: [
    ResumesService,
    ResumesAiService,
    ResumesExportService,
    ResumesParseService,
    RedisService,
    {
      provide: 'AI_PROVIDER',
      useFactory: (config: ConfigService) => {
        const openRouterApiKey = config.get<string>('OPENROUTER_API_KEY')
        const tavilyApiKey = config.get<string>('TAVILY_API_KEY') || ''
        if (!openRouterApiKey) {
          throw new Error('OPENROUTER_API_KEY environment variable is required')
        }
        return new HybridFallbackProvider(openRouterApiKey, tavilyApiKey)
      },
      inject: [ConfigService],
    },
  ],
  exports: [ResumesService],
})
export class ResumesModule {}
