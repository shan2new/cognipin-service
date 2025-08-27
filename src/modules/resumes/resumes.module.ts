import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { Resume } from '../../schema/resume.entity'
import { ResumesService } from './resumes.service'
import { ResumesController } from './resumes.controller'
import { ResumesAiService } from './resumes.ai.service'
import { ResumesExportService } from './resumes.export.service'
import { ProfileModule } from '../profile/profile.module'
import { RedisService } from '../../lib/redis.service'

@Module({
  imports: [TypeOrmModule.forFeature([Resume]), ProfileModule],
  controllers: [ResumesController],
  providers: [ResumesService, ResumesAiService, ResumesExportService, RedisService],
  exports: [ResumesService],
})
export class ResumesModule {}
