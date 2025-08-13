import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { Problem } from '../../schema/problem.entity'
import { ProblemProgress } from '../../schema/problem-progress.entity'
import { Topic } from '../../schema/topic.entity'
import { Subtopic } from '../../schema/subtopic.entity'
import { ProblemsController } from './problems.controller'
import { ProblemsService } from './problems.service'

@Module({
  imports: [TypeOrmModule.forFeature([Problem, ProblemProgress, Topic, Subtopic])],
  controllers: [ProblemsController],
  providers: [ProblemsService],
  exports: [ProblemsService],
})
export class ProblemsModule {}


