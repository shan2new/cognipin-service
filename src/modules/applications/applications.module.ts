import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { Application } from '../../schema/application.entity'
import { ApplicationCompensation } from '../../schema/application-compensation.entity'
import { Company } from '../../schema/company.entity'
import { ApplicationsController } from './applications.controller'
import { ApplicationsService } from './applications.service'
import { ApplicationQASnapshot } from '../../schema/application-qa-snapshot.entity'
import { StageHistory } from '../../schema/stage-history.entity'

@Module({
  imports: [TypeOrmModule.forFeature([Application, ApplicationCompensation, Company, StageHistory, ApplicationQASnapshot])],
  controllers: [ApplicationsController],
  providers: [ApplicationsService],
  exports: [ApplicationsService],
})
export class ApplicationsModule {}


