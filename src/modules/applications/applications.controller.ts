import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
  Delete,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common'
import { FilesInterceptor } from '@nestjs/platform-express'
import { ClerkGuard } from '../auth/clerk.guard'
import { ApplicationsService } from './applications.service'
import { ApplicationsAiService } from './applications.ai.service'
import { ApplicationsQARehearsalService } from './applications.qa-rehearsal.service'
import { ApplicationDraftService } from './applications.draft.service'
import { CompaniesService } from '../companies/companies.service'
import { PlatformsService } from '../platforms/platforms.service'
import { ApplicationStage } from '../../schema/application.entity'
import { CurrentUser, RequestUser } from '../auth/current-user.decorator'

@UseGuards(ClerkGuard)
@Controller('v1/applications')
export class ApplicationsController {
  constructor(
    private readonly svc: ApplicationsService,
    private readonly ai: ApplicationsAiService,
    private readonly qaRehearsal: ApplicationsQARehearsalService,
    private readonly drafts: ApplicationDraftService,
    private readonly companies: CompaniesService,
    private readonly platforms: PlatformsService,
  ) {}

  @Get()
  async list(
    @CurrentUser() user: RequestUser,
    @Query('search') search?: string,
    @Query('stage') stage?: string,
    @Query('milestone') milestone?: string,
    @Query('platform_id') platform_id?: string,
    @Query('source') source?: string,
    @Query('status') status?: string,
    @Query('date_from') date_from?: string,
    @Query('date_to') date_to?: string,
    @Query('ctc_min_lpa') ctc_min_lpa?: string,
    @Query('ctc_max_lpa') ctc_max_lpa?: string,
    @Query('var_pct_lte') var_pct_lte?: string,
    @Query('time_in_stage_gt') time_in_stage_gt?: string,
  ) {
    return this.svc.list(user.userId, {
      search,
      stage,
      milestone,
      platform_id,
      source,
      status,
      date_from,
      date_to,
      ctc_min_lpa,
      ctc_max_lpa,
      var_pct_lte,
      time_in_stage_gt,
    })
  }

  @Post()
  async create(
    @CurrentUser() user: RequestUser,
    @Body()
    body: {
      company: { website_url?: string; company_id?: string }
      role: string
      job_url: string
      platform_id?: string | null
      source: string
      compensation?: { fixed_min_lpa?: number; fixed_max_lpa?: number; var_min_lpa?: number; var_max_lpa?: number; note?: string }
      qa_snapshot?: {
        current_ctc_text?: string
        expected_ctc_text?: string
        notice_period_text?: string
        reason_leaving_current_text?: string
        past_leaving_reasons_text?: string
      }
    },
  ) {
    return this.svc.create(user.userId, body)
  }

  @Get(':id')
  async getById(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.svc.getById(user.userId, id)
  }

  @Patch(':id')
  async update(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body()
    body: Partial<{
      company: { website_url?: string; company_id?: string }
      company_id: string
      role: string
      job_url: string | null
      platform_id: string | null
      source: string
      stage: string | null;
      notes: string | null
      resume_variant: string | null
      compensation: { fixed_min_lpa?: number | null; fixed_max_lpa?: number | null; var_min_lpa?: number | null; var_max_lpa?: number | null; note?: string | null }
      qa_snapshot: {
        current_ctc_text?: string | null
        expected_ctc_text?: string | null
        notice_period_text?: string | null
        reason_leaving_current_text?: string | null
        past_leaving_reasons_text?: string | null
      }
    }>,
  ) {
    return this.svc.update(user.userId, id, body)
  }

  @Post(':id/transition')
  async transition(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() body: { to_stage: ApplicationStage; reason?: string; admin_override?: boolean },
  ) {
    return this.svc.transition(user.userId, id, body)
  }

  @Get(':id/stage-history')
  async history(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.svc.getStageHistory(user.userId, id)
  }

  @Delete(':id')
  async delete(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    try {
      await this.svc.delete(user.userId, id)
    } catch (e: any) {
      // Be idempotent: if already deleted or not found, still return success
      if (e?.message !== 'Application not found') throw e
    }
    return { deleted: true, id }
  }

  // Application Notes endpoints
  @Get(':id/notes')
  async getNotes(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.svc.getNotes(user.userId, id)
  }

  @Post(':id/notes')
  async createNote(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() body: { content: string },
  ) {
    return this.svc.createNote(user.userId, id, body.content)
  }

  @Delete('notes/:noteId')
  async deleteNote(@CurrentUser() user: RequestUser, @Param('noteId') noteId: string) {
    return this.svc.deleteNote(user.userId, noteId)
  }

  // AI: Extract application fields from uploaded JD image(s)
  @Post('ai/extract-from-images')
  @UseInterceptors(FilesInterceptor('files'))
  async extractFromImages(
    @CurrentUser() user: RequestUser,
    @UploadedFiles() files: Array<any>,
    @Query('draft_id') draftId?: string,
  ) {
    const data = await this.ai.extractFromJDImages(files || [])
    // Create or update draft
    const draft = draftId
      ? await this.drafts.updateDraft(user.userId, draftId, {})
      : await this.drafts.createDraft(user.userId)

    const companyWebsite = (data.company_website_url || '').trim()
    let companyId: string | null = null
    try {
      if (companyWebsite) {
        const c = await this.companies.upsertByWebsite(companyWebsite)
        companyId = (c as any).id
      }
    } catch {}

    // Fallback: derive employer by name patterns in the JD text or extracted field
    let companyName = (data.company_name as any)?.toString().trim() || ''
    if (!companyId && !companyName && data.raw_text_excerpt) {
      try {
        const text = String(data.raw_text_excerpt)
        const matchAbout = text.match(/About\s+([A-Z][\w.&-]*(?:\s[A-Z][\w.&-]*){0,3})/)
        const matchAt = matchAbout ? null : text.match(/At\s+([A-Z][\w.&-]*(?:\s[A-Z][\w.&-]*){0,3})/)
        const candidate = (matchAbout?.[1] || matchAt?.[1] || '').trim()
        const blacklist = ['Instahyre','LinkedIn','Greenhouse','Lever','Workday','Ashby','Wellfound','AngelList','Naukri','Indeed']
        if (candidate && !blacklist.some(b => candidate.toLowerCase().includes(b.toLowerCase()))) {
          companyName = candidate
        }
      } catch {}
    }
    // Extract a slug from job_url if present (e.g., matchstring=spotdraft)
    let slug = ''
    try {
      if (data.job_url) {
        const u = new URL(String(data.job_url))
        slug = (u.searchParams.get('company') || u.searchParams.get('matchstring') || u.searchParams.get('q') || '').toLowerCase().trim()
        if (!slug && u.pathname) {
          const m = u.pathname.match(/\b([a-z][a-z0-9-]{2,})\b/i)
          slug = (m?.[1] || '').toLowerCase()
        }
      }
    } catch {}

    function norm(s?: string | null) { return (s || '').toLowerCase().replace(/[^a-z0-9]+/g, '') }

    if (!companyId && (companyName || slug)) {
      try {
        const query = companyName || slug
        const companies = await this.companies.searchAndUpsert(query)
        if (companies && companies.length) {
          const ranked = companies
            .map((c: any) => ({ c, score: (() => {
              const n = norm(c.name)
              const d = norm(c.domain)
              const w = norm(c.website_url)
              const target = norm(companyName) || slug
              let s = 0
              if (target && (n.includes(target) || d.includes(target) || w.includes(target))) s += 10
              if (n.startsWith(target)) s += 5
              return s
            })() }))
            .sort((a, b) => b.score - a.score)
          companyId = (ranked[0] || companies[0] as any).c?.id || null
        }
      } catch {}
    }

    // Try platform inference: prefer explicit platform fields; else infer from job_url/excerpt
    let platformId: string | null = null
    const platformHint = (data.platform_url || data.platform_name || '').toString()
      || (data.job_url || data.raw_text_excerpt || '').toString().slice(0, 500)
    if (platformHint) {
      try {
        const platforms = await this.platforms.searchAndUpsert(platformHint)
        if (platforms && platforms.length) platformId = (platforms[0] as any).id
      } catch {}
    }

    await this.drafts.updateDraft(user.userId, (draft as any).id, {
      company_id: companyId,
      role: (data.role as any) ?? null,
      job_url: (data.job_url as any) ?? null,
      platform_id: platformId,
      compensation: (data.compensation as any) ?? null,
      notes: (data.notes as any) ?? [],
    })

    // If we detected recruiter contacts, attach them to the draft as embedded notes for now
    // We will persist them as ApplicationContacts when committing the draft
    const contacts = Array.isArray((data as any).contacts) ? (data as any).contacts : []
    if (contacts.length) {
      try {
        const extra = contacts
          .map((c: any) => [c.name, c.title, c.email, c.phone].filter(Boolean).join(' • '))
          .filter(Boolean)
        if (extra.length) {
          const d = await this.drafts.getDraft(user.userId, (draft as any).id)
          await this.drafts.updateDraft(user.userId, (draft as any).id, {
            notes: [...(d?.notes || []), ...extra].slice(0, 10)
          })
        }
      } catch {}
    }

    return { draft_id: (draft as any).id }
  }

  // AI: Extract from page network logs (fetch/xhr payloads)
  @Post('ai/extract-from-network')
  async extractFromNetwork(
    @CurrentUser() user: RequestUser,
    @Body() body: { entries: Array<any>; screenshot_data_url?: string } & { draft_id?: string }
  ) {
    const data = await this.ai.extractFromNetworkLogs(body?.entries || [], body?.screenshot_data_url)
    const draft = body?.draft_id
      ? await this.drafts.updateDraft(user.userId, body!.draft_id!, {})
      : await this.drafts.createDraft(user.userId)

    let companyId: string | null = null
    try {
      const website = (data.company_website_url || '').trim()
      if (website) {
        const c = await this.companies.upsertByWebsite(website)
        companyId = (c as any).id
      }
    } catch {}

    let platformId: string | null = null
    try {
      const hint = (data.platform_url || data.platform_name || data.job_url || '').toString()
      if (hint) {
        const platforms = await this.platforms.searchAndUpsert(hint)
        platformId = platforms?.[0]?.id || null
      }
    } catch {}

    await this.drafts.updateDraft(user.userId, (draft as any).id, {
      company_id: companyId,
      role: (data.role as any) ?? null,
      job_url: (data.job_url as any) ?? null,
      platform_id: platformId,
      compensation: (data.compensation as any) ?? null,
      notes: (data.notes as any) ?? [],
    })

    return { draft_id: (draft as any).id, ai: data }
  }

  // Draft endpoints
  @Post('drafts')
  async createDraft(@CurrentUser() user: RequestUser) {
    const d = await this.drafts.createDraft(user.userId)
    return d
  }

  @Get('drafts/:id')
  async getDraft(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.drafts.getDraft(user.userId, id)
  }

  @Patch('drafts/:id')
  async patchDraft(@CurrentUser() user: RequestUser, @Param('id') id: string, @Body() body: any) {
    return this.drafts.updateDraft(user.userId, id, body)
  }

  @Delete('drafts/:id')
  async deleteDraft(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.drafts.deleteDraft(user.userId, id)
  }

  @Post('drafts/:id/commit')
  async commitDraft(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    const app = await this.drafts.commitDraft(user.userId, id)
    // TODO: when we move contacts into draft table explicitly, we can persist to application_contact here.
    return app
  }

  // Q&A Rehearsal endpoint
  @Post(':id/qa-rehearsal')
  async generateQARehearsal(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    const app = await this.svc.getById(user.userId, id)
    if (!app.qa_snapshot) {
      return { note: 'No QA data available for this application. Add your responses in the application details.' }
    }
    
    return this.qaRehearsal.generateRehearsalResponses(
      app.qa_snapshot,
      app.role,
      app.company?.name
    )
  }
}


