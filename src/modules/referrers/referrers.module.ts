import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { Application } from '../../schema/application.entity'
import { ApplicationContact } from '../../schema/application-contact.entity'
import { Contact } from '../../schema/contact.entity'
import { ContactChannel } from '../../schema/contact-channel.entity'
import { Company } from '../../schema/company.entity'
import { ReferrersController } from './referrers.controller'
import { ReferrersService } from './referrers.service'

@Module({
  imports: [TypeOrmModule.forFeature([Application, ApplicationContact, Contact, ContactChannel, Company])],
  controllers: [ReferrersController],
  providers: [ReferrersService],
  exports: [ReferrersService],
})
export class ReferrersModule {}


