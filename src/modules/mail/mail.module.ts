import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { MailAccount } from '../../schema/mail-account.entity'
import { MailThread } from '../../schema/mail-thread.entity'
import { MailMessage } from '../../schema/mail-message.entity'
import { MailAttachment } from '../../schema/mail-attachment.entity'
import { MailService } from './mail.service'
import { MailController } from './mail.controller'
import { GmailSyncService } from './gmail.sync.service'
import { MailQueue } from './mail.queue'

@Module({
  imports: [TypeOrmModule.forFeature([MailAccount, MailThread, MailMessage, MailAttachment])],
  controllers: [MailController],
  providers: [MailService, GmailSyncService, MailQueue],
})
export class MailModule {}


