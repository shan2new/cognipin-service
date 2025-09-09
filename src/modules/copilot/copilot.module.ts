import { Module } from '@nestjs/common'
import { CopilotController } from './copilot.controller'
import { ClerkAuthModule } from '../auth/clerk.module'
import { ConfigModule } from '@nestjs/config'

@Module({
  imports: [ClerkAuthModule, ConfigModule],
  controllers: [CopilotController],
})
export class CopilotModule {}


