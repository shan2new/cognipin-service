import { Controller, Get, SetMetadata } from '@nestjs/common'
import { IS_PUBLIC_KEY } from './modules/auth/clerk.guard'

export const Public = () => SetMetadata(IS_PUBLIC_KEY, true)

@Controller()
export class AppController {
  @Public()
  @Get('/health')
  health() {
    return { ok: true }
  }
}


