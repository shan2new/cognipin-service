import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { Problem } from '../../schema/problem.entity'
import { ProblemProgress } from '../../schema/problem-progress.entity'
import { ProgressController } from './progress.controller'
import { ProgressService } from './progress.service'

@Module({
  imports: [TypeOrmModule.forFeature([Problem, ProblemProgress])],
  controllers: [ProgressController],
  providers: [ProgressService],
})
export class ProgressModule {}


