import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common'
import { ClerkGuard } from '../auth/clerk.guard'
import { CurrentUser, RequestUser } from '../auth/current-user.decorator'
import { MailService } from './mail.service'
import { MailQueue } from './mail.queue'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { MailAccount } from '../../schema/mail-account.entity'
import { createClerkClient } from '@clerk/backend'
import { ConfigService } from '@nestjs/config'

@UseGuards(ClerkGuard)
@Controller('v1/mail')
export class MailController {
  constructor(private readonly svc: MailService, private readonly queue: MailQueue, @InjectRepository(MailAccount) private readonly accountRepo: Repository<MailAccount>, private readonly config: ConfigService) {}

  // Base scopes required for everyone
  private readonly BASE_REQUIRED_GMAIL_SCOPES = [
    'https://www.googleapis.com/auth/gmail.readonly',
  ]

  // (Removed) custom OAuth connect/callback - Clerk handles Google OAuth

  // Manual disconnect
  @Post('accounts/:id/disconnect')
  async disconnect(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.svc.disconnect(user.userId, id)
  }

  // Manual sync trigger
  @Post('accounts/:id/sync')
  async sync(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.svc.triggerSync(user.userId, id)
  }

  // List threads (basic)
  @Get('threads')
  async listThreads(
    @CurrentUser() user: RequestUser,
    @Query('query') q?: string,
    @Query('before') before?: string,
  ) {
    // If an account exists, enqueue a sync job. Do not auto-create accounts from Clerk state.
    const acc = await this.accountRepo.findOne({ where: { user_id: user.userId }, order: { updated_at: 'DESC' } as Record<string, 'ASC' | 'DESC'> })
    if (acc?.id) await this.queue.enqueueSync(user.userId, acc.id)
    return this.svc.listThreads(user.userId, { q, before })
  }

  // Debug endpoint for queue status
  @Get('status')
  async status(
    @CurrentUser() user: RequestUser,
  ) {
    const acc = await this.accountRepo.findOne({ where: { user_id: user.userId }, order: { updated_at: 'DESC' } as Record<string, 'ASC' | 'DESC'> })
    let hasGoogleLinked = false
    let hasToken = false
    let scopes: string[] = []
    let additionalScopes: string[] = []
    try {
      const clerk = createClerkClient({ secretKey: this.config.get<string>('CLERK_SECRET_KEY')! })
      const u = await clerk.users.getUser(user.userId)
      // Read additional per-user scopes from publicMetadata
      const meta = (u as unknown as { publicMetadata?: Record<string, unknown> })?.publicMetadata || {}
      additionalScopes = Array.isArray((meta as any).additionalScopes) ? ((meta as any).additionalScopes as Array<string>).filter(Boolean) : []
      const externalAccounts = (u as unknown as { externalAccounts?: Array<{ provider?: string; approvedScopes?: string | null; approved_scopes?: string | null }> }).externalAccounts || []
      hasGoogleLinked = externalAccounts.some(ea => ea.provider === 'google' || ea.provider === 'oauth_google')
      const tokRes = await clerk.users.getUserOauthAccessToken(user.userId, 'google') as { data?: Array<{ token?: string }> } | Array<{ token?: string }>
      const token = Array.isArray(tokRes) ? tokRes[0]?.token : tokRes?.data?.[0]?.token
      hasToken = !!token
      const ea = externalAccounts.find(e => e.provider === 'google' || e.provider === 'oauth_google')
      const approvedStr = (ea?.approvedScopes || (ea as any)?.approved_scopes || '') as string
      if (approvedStr) scopes = approvedStr.split(' ').filter(Boolean)
    } catch {
      // ignore clerk lookup failures
    }
    // Do not fall back to stored DB scopes or tokens; rely on Clerk for OAuth state

    const requiredScopes = [...this.BASE_REQUIRED_GMAIL_SCOPES, ...additionalScopes]
    const missingScopes = requiredScopes.filter(s => !scopes.includes(s))
    const hasRequiredScopes = missingScopes.length === 0
    const queue = await this.queue.getStatus(acc?.id)
    return { ...queue, hasAccount: !!acc, hasGoogleLinked, needsAuth: !hasToken, scopes, hasRequiredScopes, missingScopes, requiredScopes }
  }

  @Get('threads/:id/messages')
  async listMessages(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.svc.listMessages(user.userId, id)
  }

  @Post('threads/:id/assign')
  async assign(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() body: { application_id: string }
  ) {
    return this.svc.assignThread(user.userId, id, body.application_id)
  }

  @Post('threads/:id/reply')
  async reply(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() body: { text?: string; html?: string }
  ) {
    return this.svc.replyToThread(user.userId, id, body)
  }

  // Update per-user additional scopes in Clerk publicMetadata
  @Post('scopes')
  async updateScopes(
    @CurrentUser() user: RequestUser,
    @Body() body: { send_enabled?: boolean; additionalScopes?: string[] }
  ) {
    const clerk = createClerkClient({ secretKey: this.config.get<string>('CLERK_SECRET_KEY')! })
    const u = await clerk.users.getUser(user.userId)
    const currentAdditional = ((((u as unknown as { publicMetadata?: Record<string, unknown> })?.publicMetadata || {}) as any).additionalScopes as Array<string> | undefined) || []
    let nextAdditional = Array.from(new Set(currentAdditional))

    // If explicit additionalScopes provided, trust it. Otherwise, toggle gmail.send via send_enabled
    if (Array.isArray(body.additionalScopes)) {
      nextAdditional = body.additionalScopes.filter(Boolean)
    } else if (typeof body.send_enabled === 'boolean') {
      const sendScope = 'https://www.googleapis.com/auth/gmail.send'
      if (body.send_enabled) {
        if (!nextAdditional.includes(sendScope)) nextAdditional.push(sendScope)
      } else {
        nextAdditional = nextAdditional.filter(s => s !== sendScope)
      }
    }

    await clerk.users.updateUserMetadata(user.userId, {
      publicMetadata: {
        additionalScopes: nextAdditional,
      },
    })
    return { additionalScopes: nextAdditional }
  }

  // Ensure an account row exists for the user once Google is linked in Clerk
  @Post('accounts/ensure')
  async ensureAccount(@CurrentUser() user: RequestUser) {
    let acc = await this.accountRepo.findOne({ where: { user_id: user.userId }, order: { updated_at: 'DESC' } as Record<string, 'ASC' | 'DESC'> })
    if (!acc) {
      acc = await this.accountRepo.save(
        this.accountRepo.create({
          user_id: user.userId,
          provider: 'gmail',
          email: '',
          last_history_id: null,
          last_sync_at: null,
          watch_expiration: null,
        })
      )
    }
    return acc
  }
}


