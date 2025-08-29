import { Injectable, NotFoundException, Logger } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { MailAccount } from '../../schema/mail-account.entity'
import { MailThread } from '../../schema/mail-thread.entity'
import { MailMessage } from '../../schema/mail-message.entity'
import { GmailSyncService } from './gmail.sync.service'
import { MailQueue } from './mail.queue'
import { ConfigService } from '@nestjs/config'
// Deprecated: direct token storage removed in favor of Clerk-managed OAuth

@Injectable()
export class MailService {
  constructor(
    @InjectRepository(MailAccount) private readonly accountRepo: Repository<MailAccount>,
    @InjectRepository(MailThread) private readonly threadRepo: Repository<MailThread>,
    @InjectRepository(MailMessage) private readonly msgRepo: Repository<MailMessage>,
    private readonly sync: GmailSyncService,
    private readonly queue: MailQueue,
    private readonly config: ConfigService,
  ) {}
  private readonly log = new Logger(MailService.name)

  // (Removed) getGmailConnectUrl - Clerk handles Google OAuth

  async disconnect(userId: string, accountId: string) {
    const acc = await this.accountRepo.findOne({ where: { id: accountId, user_id: userId } })
    if (!acc) throw new NotFoundException('Account not found')
    await this.accountRepo.remove(acc)
    return { ok: true }
  }

  async triggerSync(userId: string, accountId: string) {
    const acc = await this.accountRepo.findOne({ where: { id: accountId, user_id: userId } })
    if (!acc) throw new NotFoundException('Account not found')
    await this.queue.enqueueSync(userId, accountId)
    return { ok: true, enqueued: true }
  }

  async listThreads(userId: string, opts: { q?: string; before?: string }) {
    const qb = this.threadRepo
      .createQueryBuilder('t')
      .innerJoin(MailAccount, 'a', 'a.id = t.account_id')
      .where('a.user_id = :userId', { userId })
    if (opts.before) {
      qb.andWhere('t.latest_at < :before', { before: new Date(opts.before) })
    }
    // Optional basic search on subject/snippet
    if (opts.q && opts.q.trim()) {
      qb.andWhere('(t.subject ILIKE :q OR t.snippet ILIKE :q)', { q: `%${opts.q.trim()}%` })
    }
    const threads = await qb.orderBy('t.latest_at', 'DESC').take(50).getMany()
    return threads
  }

  async listMessages(userId: string, threadId: string) {
    const thread = await this.threadRepo.findOne({ where: { id: threadId } })
    if (!thread) throw new NotFoundException('Thread not found')
    const msgs = await this.msgRepo.find({ where: { thread_id: threadId }, order: { internal_date: 'ASC' } })
    return msgs
  }

  async assignThread(userId: string, threadId: string, applicationId: string) {
    const thread = await this.threadRepo.findOne({ where: { id: threadId } })
    if (!thread) throw new NotFoundException('Thread not found')
    thread.application_id = applicationId
    thread.assigned_by = userId
    thread.assigned_at = new Date()
    await this.threadRepo.save(thread)
    return thread
  }

  async replyToThread(userId: string, threadId: string, body: { text?: string; html?: string }) {
    const thread = await this.threadRepo.findOne({ where: { id: threadId } })
    if (!thread) throw new NotFoundException('Thread not found')
    const account = await this.accountRepo.findOne({ where: { id: thread.account_id, user_id: userId } })
    if (!account) throw new NotFoundException('Account not found')

    // Build Gmail auth client from stored token
    const { google } = await import('googleapis')
    const clientId = this.config.get<string>('GOOGLE_CLIENT_ID')
    const clientSecret = this.config.get<string>('GOOGLE_CLIENT_SECRET')
    const redirectUri = this.config.get<string>('GOOGLE_REDIRECT_URI')
    const oauth2 = new (google as any).auth.OAuth2(clientId, clientSecret, redirectUri)
    // Prefer Clerk-provided access token
    try {
      const { createClerkClient } = await import('@clerk/backend')
      const clerk = createClerkClient({ secretKey: this.config.get<string>('CLERK_SECRET_KEY')! })
      const tokens = await clerk.users.getUserOauthAccessToken(userId, 'google') as { data?: Array<{ token?: string }> } | Array<{ token?: string }>
      const token = Array.isArray(tokens) ? tokens[0]?.token : tokens?.data?.[0]?.token
      if (token) oauth2.setCredentials({ access_token: token })
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e)
      this.log.warn(`Failed to get Gmail token from Clerk for account=${account.id}: ${message}`)
    }
    const gmail = (google as any).gmail({ version: 'v1', auth: oauth2 })

    // Determine reply target using last inbound message
    const lastInbound = await this.msgRepo.find({ where: { thread_id: threadId }, order: { internal_date: 'DESC' }, take: 1 })
    const toHeader = lastInbound[0]?.from?.value || ''
    const subject = (thread.subject && thread.subject.startsWith('Re: ')) ? thread.subject : `Re: ${thread.subject || ''}`

    // Resolve sender email
    let fromEmail = account.email
    try {
      const prof = await gmail.users.getProfile({ userId: 'me' })
      if (prof?.data?.emailAddress) fromEmail = prof.data.emailAddress
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      this.log.warn(`Failed to resolve Gmail profile email for account=${account.id}: ${message}`)
    }

    const text = body.text ?? ''
    const mime = [
      `From: <${fromEmail}>`,
      `To: ${toHeader}`,
      `Subject: ${subject}`,
      'MIME-Version: 1.0',
      'Content-Type: text/plain; charset=UTF-8',
      '',
      text,
    ].join('\r\n')

    const raw = Buffer.from(mime).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

    let sentId: string | null = null
    try {
      const resp = await gmail.users.messages.send({
        userId: 'me',
        requestBody: { raw, threadId: thread.gmail_thread_id },
      })
      sentId = resp?.data?.id || null
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      this.log.warn(`Failed to send Gmail message for thread=${thread.id}: ${message}`)
    }

    const now = new Date()
    const saved = await this.msgRepo.save(
      this.msgRepo.create({
        thread_id: threadId,
        gmail_message_id: sentId || `local-${now.getTime()}`,
        internal_date: now,
        headers: null,
        from: { value: fromEmail } as unknown as Record<string, unknown>,
        to: { value: toHeader } as unknown as Record<string, unknown>,
        cc: null,
        bcc: null,
        subject,
        body_text: text,
        body_html: null,
        label_ids: ['SENT'],
        has_attachments: false,
        direction: 'outbound',
      })
    )
    thread.latest_at = now
    await this.threadRepo.save(thread)
    return saved
  }
}


