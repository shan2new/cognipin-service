import { Injectable, NotFoundException, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { createClerkClient } from '@clerk/backend'
import { InjectRepository } from '@nestjs/typeorm'
import { google, gmail_v1 } from 'googleapis'
import { Repository } from 'typeorm'
import { MailAccount } from '../../schema/mail-account.entity'
import { MailThread } from '../../schema/mail-thread.entity'
import { MailMessage } from '../../schema/mail-message.entity'

function base64UrlToString(data?: string | null): string | null {
  if (!data) return null
  try {
    const buf = Buffer.from(data.replace(/-/g, '+').replace(/_/g, '/'), 'base64')
    return buf.toString('utf8')
  } catch {
    return null
  }
}

function textFromPayload(payload?: gmail_v1.Schema$MessagePart | null): { text?: string | null; html?: string | null; hasAttachments: boolean } {
  let text: string | null | undefined
  let html: string | null | undefined
  let hasAttachments = false
  const walk = (part?: gmail_v1.Schema$MessagePart | null) => {
    if (!part) return
    const mime = part.mimeType || ''
    if (mime === 'text/plain' && !text) text = base64UrlToString(part.body?.data || null)
    if (mime === 'text/html' && !html) html = base64UrlToString(part.body?.data || null)
    if (part.filename) hasAttachments = hasAttachments || !!part.filename
    if (part.parts) part.parts.forEach(walk)
  }
  walk(payload || undefined)
  return { text: text ?? null, html: html ?? null, hasAttachments }
}

function header(headers: gmail_v1.Schema$MessagePartHeader[] | undefined, name: string): string | undefined {
  const h = headers?.find(h => (h.name || '').toLowerCase() === name.toLowerCase())
  return h?.value || undefined
}

function isJobRelated(subject?: string | null, from?: string | null, to?: string | null, bodyText?: string | null): boolean {
  const s = (subject || '').toLowerCase()
  const f = (from || '').toLowerCase()
  const t = (to || '').toLowerCase()
  const b = (bodyText || '').toLowerCase()

  const keywords = [
    'job', 'role', 'position', 'opening', 'opportunity', 'career', 'careers', 'hiring', 'hire', 'application', 'applied',
    'interview', 'screening', 'recruiter', 'talent', 'offer', 'assessment', 'take-home', 'challenge', 'coding test',
  ]
  const atsVendors = [
    'greenhouse', 'lever', 'workday', 'ashby', 'smartrecruiters', 'jobvite', 'workable', 'bamboohr', 'teamtailor', 'rippling',
    'indeed', 'linkedin', 'wellfound', 'angellist', 'instahyre', 'naukri', 'codility', 'codesignal', 'hackerrank', 'hackerearth'
  ]

  const containsAny = (txt: string, arr: string[]) => arr.some(k => txt.includes(k))

  if (containsAny(s, keywords) || containsAny(b, keywords)) return true
  if (containsAny(f, keywords) || containsAny(t, keywords)) return true
  if (containsAny(f, atsVendors) || containsAny(t, atsVendors) || containsAny(s, atsVendors)) return true
  // Heuristic on addresses like careers@, jobs@, recruiting@, hr@
  if (/\b(careers|jobs|recruit|recruiter|talent|hr|hiring)@/.test(f)) return true
  return false
}

@Injectable()
export class GmailSyncService {
  constructor(
    private readonly config: ConfigService,
    @InjectRepository(MailAccount) private readonly accountRepo: Repository<MailAccount>,
    @InjectRepository(MailThread) private readonly threadRepo: Repository<MailThread>,
    @InjectRepository(MailMessage) private readonly msgRepo: Repository<MailMessage>,
  ) {}
  private readonly log = new Logger(GmailSyncService.name)

  private oauthClient() {
    const clientId = this.config.get<string>('GOOGLE_CLIENT_ID')
    const clientSecret = this.config.get<string>('GOOGLE_CLIENT_SECRET')
    const redirectUri = this.config.get<string>('GOOGLE_REDIRECT_URI')
    return new google.auth.OAuth2(clientId, clientSecret, redirectUri)
  }

  async syncAccount(userId: string, accountId: string): Promise<{ importedThreads: number; importedMessages: number }> {
    const account = await this.accountRepo.findOne({ where: { id: accountId, user_id: userId } })
    if (!account) throw new NotFoundException('Account not found')

    // Prepare OAuth client
    const oauth2 = this.oauthClient()
    // Fetch a fresh Google access token for this user from Clerk
    let hasToken = false
    try {
      const clerk = createClerkClient({ secretKey: this.config.get<string>('CLERK_SECRET_KEY')! })
      const tokens = await clerk.users.getUserOauthAccessToken(userId, 'google') as { data?: Array<{ token?: string }> } | Array<{ token?: string }>
      const token = Array.isArray(tokens) ? tokens[0]?.token : tokens?.data?.[0]?.token
      if (token) {
        oauth2.setCredentials({ access_token: token })
        hasToken = true
      }
    } catch (e: unknown) {
      if (!hasToken) {
        const message = e instanceof Error ? e.message : String(e)
        this.log.warn(`Failed to load Gmail access token for account=${account.id}: ${message}`)
        return { importedThreads: 0, importedMessages: 0 }
      }
    }
    if (!hasToken) {
      this.log.warn(`No Google access token for user=${userId}, skip sync`)
      return { importedThreads: 0, importedMessages: 0 }
    }
    const gmail = google.gmail({ version: 'v1', auth: oauth2 })

    // Fetch profile to capture email if missing
    try {
      const prof = await gmail.users.getProfile({ userId: 'me' })
      const emailAddress = prof.data.emailAddress || null
      if (emailAddress && account.email !== emailAddress) {
        account.email = emailAddress
        await this.accountRepo.save(account)
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      this.log.warn(`Failed to fetch Gmail profile for account=${account.id}: ${message}`)
    }

    let importedThreads = 0
    let importedMessages = 0

    // Fetch recent potentially job-related threads using Gmail search query. Use OR for inbox/sent.
    const jobQuery = [
      'newer_than:180d',
      '(in:inbox OR in:sent)',
      '(',
        'subject:(job OR role OR position OR interview OR application OR offer OR career OR hiring)',
        'OR from:(recruiter OR careers OR jobs OR talent)',
        'OR to:(recruiter OR careers OR jobs OR talent)',
        'OR (greenhouse OR lever OR workday OR smartrecruiters OR jobvite OR workable OR bamboohr OR teamtailor)',
      ')'
    ].join(' ')
    this.log.log(`Sync query account=${account.id} q="${jobQuery}"`)
    const listResp = await gmail.users.threads.list({ userId: 'me', q: jobQuery, maxResults: 50 })
    const threadIds = (listResp.data.threads || []).map(t => t.id!).filter(Boolean)

    for (const tid of threadIds) {
      const thr = await gmail.users.threads.get({ userId: 'me', id: tid, format: 'full' })
      const msgs = thr.data.messages || []
      // Filter messages by job-related heuristics
      const filtered: gmail_v1.Schema$Message[] = []
      for (const m of msgs) {
        const headers = m.payload?.headers || []
        const mSubject = header(headers, 'Subject') || null
        const mFrom = header(headers, 'From') || null
        const mTo = header(headers, 'To') || null
        const parts = textFromPayload(m.payload || undefined)
        if (isJobRelated(mSubject, mFrom, mTo, parts.text || parts.html)) {
          filtered.push(m)
        }
      }
      if (!filtered.length) {
        this.log.debug?.(`Skip non-job thread ${tid}`)
        continue
      }

      let thread = await this.threadRepo.findOne({ where: { gmail_thread_id: tid } })
      if (!thread) {
        thread = await this.threadRepo.save(
          this.threadRepo.create({
            account_id: account.id,
            gmail_thread_id: tid,
            subject: null,
            snippet: null,
            preview_from: null,
            preview_to: null,
            latest_at: new Date(),
            application_id: null,
            assigned_by: null,
            assigned_at: null,
          })
        )
      }

      let latest = thread.latest_at
      for (const m of filtered) {
        if (!m.id) continue
        const existing = await this.msgRepo.findOne({ where: { gmail_message_id: m.id } })
        if (existing) continue

        const internalMs = Number(m.internalDate || 0)
        const msgDate = internalMs ? new Date(internalMs) : new Date()
        const headers = m.payload?.headers || []
        const subject = header(headers, 'Subject') || null
        const from = header(headers, 'From') || null
        const to = header(headers, 'To') || null
        const cc = header(headers, 'Cc') || null
        const bcc = header(headers, 'Bcc') || null

        const parts = textFromPayload(m.payload || undefined)
        const direction: 'inbound' | 'outbound' = (m.labelIds || []).includes('SENT') ? 'outbound' : 'inbound'

        await this.msgRepo.save(
          this.msgRepo.create({
            thread_id: thread.id,
            gmail_message_id: m.id,
            internal_date: msgDate,
            headers: headers,
            from: from ? { value: from } : null,
            to: to ? { value: to } : null,
            cc: cc ? { value: cc } : null,
            bcc: bcc ? { value: bcc } : null,
            subject,
            body_text: parts.text,
            body_html: parts.html,
            label_ids: m.labelIds ? [...m.labelIds] : null,
            has_attachments: parts.hasAttachments,
            direction,
          })
        )

        if (msgDate > latest) latest = msgDate
        importedMessages += 1
      }

      // Update thread preview
      thread.subject = thread.subject || header(msgs[msgs.length - 1]?.payload?.headers || [], 'Subject') || null
      thread.snippet = thr.data.snippet || thread.snippet
      thread.latest_at = latest
      await this.threadRepo.save(thread)
      importedThreads += 1
    }

    account.last_sync_at = new Date()
    await this.accountRepo.save(account)

    this.log.log(`Sync done account=${account.id} threads=${importedThreads} messages=${importedMessages}`)
    return { importedThreads, importedMessages }
  }
}


