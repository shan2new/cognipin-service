import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { verifyToken } from '@clerk/backend'

export const IS_PUBLIC_KEY = 'isPublic'

@Injectable()
export class ClerkGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ])
    if (isPublic) return true

    const req = context.switchToHttp().getRequest()

    // Prefer Authorization: Bearer <token>, fall back to Clerk session cookie
    const auth = (req.headers['authorization'] as string | undefined) || ''
    const bearer = auth.startsWith('Bearer ') ? auth.slice('Bearer '.length) : undefined
    const cookieToken = (req.cookies && req.cookies['__session']) || undefined
    const token = bearer || cookieToken

    if (!token) {
      throw new UnauthorizedException('Missing auth token')
    }

    try {
      const verified = await verifyToken(token, {
        secretKey: process.env.CLERK_SECRET_KEY!,
        // Allow small clock skew per Clerk recommendation (tokens rotate frequently)
        clockSkewInMs: 60_000,
      })

      console.log('verified', verified.sub)
      req.user = { userId: verified.sub }
      return true
    } catch (err: any) {
      // Map common verification errors to clearer messages
      const name = err?.name || ''
      if (name === 'TokenExpiredError') {
        throw new UnauthorizedException('Token expired')
      }
      if (name === 'JsonWebTokenError') {
        throw new UnauthorizedException('Invalid token')
      }
      if (name === 'NotBeforeError') {
        throw new UnauthorizedException('Token not yet valid')
      }
      throw new UnauthorizedException('Authentication failed')
    }
  }
}


