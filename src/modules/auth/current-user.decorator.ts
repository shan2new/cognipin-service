import { createParamDecorator, ExecutionContext } from '@nestjs/common'

export interface RequestUser {
  userId: string
}

export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext) => {
  const request = ctx.switchToHttp().getRequest()
  return (request.user as RequestUser) ?? undefined
})


