import { Global, Module } from '@nestjs/common'
import { ClerkGuard } from './clerk.guard'

@Global()
@Module({
  providers: [ClerkGuard],
  exports: [ClerkGuard],
})
export class ClerkAuthModule {}


