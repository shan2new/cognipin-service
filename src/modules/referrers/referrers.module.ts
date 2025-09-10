import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { Application } from '../../schema/application.entity'
import { ApplicationContact } from '../../schema/application-contact.entity'
import { Contact } from '../../schema/contact.entity'
import { ContactChannel } from '../../schema/contact-channel.entity'
import { Company } from '../../schema/company.entity'
import { ReferrersController } from './referrers.controller'
import { UserReferrer } from '../../schema/user-referrer.entity'
import { UserReferrerCompany } from '../../schema/user-referrer-company.entity'
import { ReferrersService } from './referrers.service'

@Module({
  imports: [TypeOrmModule.forFeature([Application, ApplicationContact, Contact, ContactChannel, Company, UserReferrer, UserReferrerCompany])],
  controllers: [ReferrersController],
  providers: [ReferrersService],
  exports: [ReferrersService],
})
export class ReferrersModule {}


