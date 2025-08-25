import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { Resume } from '../../schema/resume.entity'
import { ResumesService } from './resumes.service'
import { ResumesController } from './resumes.controller'
import { ResumesAiService } from './resumes.ai.service'
import { ResumesExportService } from './resumes.export.service'

@Module({
  imports: [TypeOrmModule.forFeature([Resume])],
  controllers: [ResumesController],
  providers: [ResumesService, ResumesAiService, ResumesExportService],
  exports: [ResumesService],
})
export class ResumesModule {}
