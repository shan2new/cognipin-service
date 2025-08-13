import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { RoadmapController } from './roadmap.controller'
import { Section } from '../../schema/section.entity'
import { Topic } from '../../schema/topic.entity'

@Module({
  imports: [TypeOrmModule.forFeature([Section])],
  controllers: [RoadmapController],
})
export class RoadmapModule {}


