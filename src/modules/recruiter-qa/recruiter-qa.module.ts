import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { RecruiterQA } from '../../schema/recruiter-qa.entity'
import { RecruiterQAController } from './recruiter-qa.controller'
import { RecruiterQAService } from './recruiter-qa.service'

@Module({
  imports: [TypeOrmModule.forFeature([RecruiterQA])],
  controllers: [RecruiterQAController],
  providers: [RecruiterQAService],
  exports: [RecruiterQAService],
})
export class RecruiterQAModule {}


