import { Controller, Get, Post, Put, Delete, Param, Body, UseGuards, UploadedFile, UseInterceptors, Res, Query, Header, Logger, Inject } from '@nestjs/common'
import { ResumesService } from './resumes.service'
// Import type only to avoid ts-node resolution issues in lint stage
type Resume = any
import { ResumesAiService } from './resumes.ai.service'
import { ResumesExportService } from './resumes.export.service'
import { ResumesParseService } from './resumes.parse.service'
import { ProfileService } from '../profile/profile.service'
import type { Response } from 'express'
import { FileFieldsInterceptor, FileInterceptor } from '@nestjs/platform-express'
import { ClerkGuard } from '../auth/clerk.guard'
import { CurrentUser, RequestUser } from '../auth/current-user.decorator'
import { RedisService } from '../../lib/redis.service'

@Controller('v1/resumes')
@UseGuards(ClerkGuard)
export class ResumesController {
  constructor(
    private readonly resumesService: ResumesService,
    private readonly ai: ResumesAiService,
    private readonly exporter: ResumesExportService,
    private readonly profileSvc: ProfileService,
    private readonly redis: RedisService,
    private readonly parser: ResumesParseService,
    @Inject('AI_PROVIDER') private readonly hybrid: any,
  ) {}
  private readonly logger = new Logger(ResumesController.name)

  private cacheKey(userId: string, resumeId: string) {
    return `resume:${userId}:${resumeId}:v1`
  }

  @Get()
  async findAll(@CurrentUser() user: RequestUser) {
    return this.resumesService.findAllByUser(user.userId)
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    // Try Redis cache first for speed
    const key = this.cacheKey(user.userId, id)
    try {
      const cached = await this.redis.get(key)
      if (cached) {
        try {
          const parsed = JSON.parse(cached)
          // Warm the cache again to extend freshness (idempotent)
          this.redis.set(key, JSON.stringify(parsed)).catch(() => {})
          return parsed
        } catch {}
      }
    } catch {}

    // Fallback to DB and warm cache
    const resume = await this.resumesService.findOne(id, user.userId)
    if (!resume) {
      throw new Error('Resume not found')
    }
    try {
      await this.redis.set(key, JSON.stringify(resume))
    } catch {}
    return resume
  }

  @Post()
  async create(@Body() data: Partial<Resume>, @CurrentUser() user: RequestUser) {
    return this.resumesService.create(user.userId, data)
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() data: Partial<Resume>, @CurrentUser() user: RequestUser) {
    // Immediate write to cache for fast UX
    const key = this.cacheKey(user.userId, id)
    const cachedPayload = { ...(data as any), id, user_id: user.userId }
    try {
      await this.redis.set(key, JSON.stringify(cachedPayload))
    } catch (err) {
      this.logger.warn('[ResumeUpdate] failed to set cache, proceeding', err as any)
    }

    // Async write-back to DB without blocking response
    setImmediate(async () => {
      try {
        const res = await this.resumesService.update(id, user.userId, data)
        if (res) {
          try { await this.redis.set(key, JSON.stringify(res)) } catch {}
        }
      } catch (err) {
        this.logger.error('[ResumeUpdate] DB write-back failed', err as any)
      }
    })

    // Return fast acknowledgement with the cached payload
    return { success: true }
  }

  @Post(':id/duplicate')
  async duplicate(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    const resume = await this.resumesService.duplicate(id, user.userId)
    if (!resume) {
      throw new Error('Resume not found')
    }
    return resume
  }

  @Post(':id/set-default')
  async setDefault(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    const resume = await this.resumesService.setDefault(id, user.userId)
    if (!resume) {
      throw new Error('Resume not found')
    }
    return resume
  }

  @Delete(':id')
  async delete(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    const success = await this.resumesService.delete(id, user.userId)
    if (!success) {
      throw new Error('Resume not found')
    }
    return { success }
  }

  // --- AI helpers ---
  @Post(':id/ai/suggest-summary')
  async suggestSummary(@Param('id') id: string, @CurrentUser() user: RequestUser, @Body() body: { job?: string }) {
    const resume = await this.resumesService.findOne(id, user.userId)
    if (!resume) throw new Error('Resume not found')
    return this.ai.suggestSummary({ personal_info: (resume as any).personal_info, sections: (resume as any).sections, job: body?.job })
  }

  @Post(':id/ai/suggest-bullets')
  async suggestBullets(@Param('id') id: string, @CurrentUser() user: RequestUser, @Body() body: { sectionId?: string; role?: string; jd?: string }) {
    const resume = await this.resumesService.findOne(id, user.userId)
    if (!resume) throw new Error('Resume not found')
    return this.ai.suggestBullets({ role: body?.role, jd: body?.jd, experience: (resume as any).sections })
  }

  // AI rewrite/proofread for any small text (summary line, bullet, paragraph)
  @Post(':id/ai/enhance-text')
  async enhanceText(
    @Param('id') id: string,
    @CurrentUser() user: RequestUser,
    @Body() body: { text: string; mode?: 'rewrite' | 'proofread'; contentType?: 'summary' | 'bullet' | 'paragraph'; tone?: 'professional' | 'confident' | 'friendly' | 'concise' }
  ) {
    // Use cached resume to avoid DB hit for speed
    const key = this.cacheKey(user.userId, id)
    let resume: any = null
    try {
      const cached = await this.redis.get(key)
      if (cached) {
        try { resume = JSON.parse(cached) } catch { resume = null }
      }
    } catch {}
    if (!resume) {
      const fromDb = await this.resumesService.findOne(id, user.userId)
      if (!fromDb) throw new Error('Resume not found')
      resume = fromDb
      // Warm cache for subsequent fast calls
      this.redis.set(key, JSON.stringify(fromDb)).catch(() => {})
    }
    const text = typeof body?.text === 'string' ? body.text : ''
    if (!text.trim()) return { text: '' }
    const mode = (body?.mode === 'proofread' ? 'proofread' : 'rewrite') as 'rewrite' | 'proofread'
    const result = await this.hybrid.enhanceResumeText({
      text,
      mode,
      contentType: (body?.contentType || 'paragraph') as any,
      tone: (body?.tone || (mode === 'rewrite' ? 'professional' : 'concise')) as any,
      field: body?.contentType,
      resume,
    })
    return result
  }

  @Post(':id/ai/keywords')
  async extractKeywords(@Param('id') id: string, @CurrentUser() user: RequestUser, @Body() body: { jd: string }) {
    const resume = await this.resumesService.findOne(id, user.userId)
    if (!resume) throw new Error('Resume not found')
    return this.ai.extractKeywords({ jd: body?.jd, resume })
  }

  // Analyze JD for alignment and suggestions. Accept JSON or multipart with files
  @Post(':id/ai/analyze-jd')
  @UseInterceptors(FileFieldsInterceptor([
    { name: 'files', maxCount: 6 },
  ]))
  async analyzeJd(
    @Param('id') id: string,
    @CurrentUser() user: RequestUser,
    @Body() body: { jdText?: string; jdUrl?: string },
    @UploadedFile() _unused?: any,
  ) {
    const resume = await this.resumesService.findOne(id, user.userId)
    if (!resume) throw new Error('Resume not found')
    const jd = (body?.jdText || '').trim()
    const url = (body?.jdUrl || '').trim()
    try {
      const result = await this.hybrid.enhanceResumeText({
        text: [
          'Provide a concise analysis for resume vs JD alignment. Return bullet points only.',
          'Identify: missing keywords, skill alignment, rewrite opportunities (summary/bullets), ATS issues, role level fit, and suggested section reorder.',
          `JD URL: ${url || 'n/a'}`,
          `JD Text: ${(jd || '').slice(0, 4000)}`,
          `Resume JSON: ${(JSON.stringify(resume) || '').slice(0, 12000)}`,
        ].join('\n'),
        mode: 'proofread',
        contentType: 'paragraph',
        tone: 'concise',
      })
      const lines = (result?.text || '').split(/\n+/).map((s: string) => s.replace(/^[-•\s]+/, '').trim()).filter(Boolean)
      const items = lines.slice(0, 24).map((msg: string) => ({ section: 'summary', type: 'rewrite', message: msg }))
      return { items }
    } catch {
      return { items: [] }
    }
  }

  // Generate a default resume strictly in schema from the user's profile
  @Post('ai/generate-from-profile')
  async generateFromProfile(@CurrentUser() user: RequestUser, @Body() body: { profile?: any }) {
    // Prefer the saved profile from DB; fall back to body if provided
    let profile = body?.profile
    if (!profile) {
      try {
        profile = await this.profileSvc.get(user.userId)
      } catch {
        // ignore
      }
    }

    const cacheKey = `resume_ai_seed:${user.userId}:v1`
    try {
      const cached = await this.redis.get(cacheKey)
      if (cached) {
        const parsed = JSON.parse(cached)
        if (isValidResumeSeed(parsed)) {
          console.log('[AI] generate-from-profile: serving VALID cached seed for user', user.userId)
          return parsed
        } else {
          console.log('[AI] generate-from-profile: cached seed INVALID, regenerating for user', user.userId)
        }
      } else {
        console.log('[AI] generate-from-profile: no cache, generating for user', user.userId)
      }
    } catch (err) {
      console.warn('[AI] generate-from-profile: cache error, proceeding without cache', err)
    }

    const result = await this.ai.generateDefaultFromProfile(profile || { user: { id: user.userId } })

    // Only cache valid responses for 1 day
    if (isValidResumeSeed(result)) {
      try {
        await this.redis.setex(cacheKey, 60 * 60 * 24, JSON.stringify(result))
        console.log('[AI] generate-from-profile: cached VALID seed for 1 day for user', user.userId)
      } catch (err) {
        console.warn('[AI] generate-from-profile: failed to cache seed', err)
      }
    } else {
      console.warn('[AI] generate-from-profile: generated seed INVALID, returning anyway (will not cache) for user', user.userId)
    }

    return result
  }

  // --- Import --- (LinkedIn import removed)

  @Post('import/pdf')
  @Header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
  @Header('Pragma', 'no-cache')
  @Header('Expires', '0')
  @Header('Vary', 'Authorization')
  @UseInterceptors(FileInterceptor('file'))
  async importPdf(@CurrentUser() _user: RequestUser, @UploadedFile() file?: any) {
    const start = Date.now()
    const name = (file && typeof file.originalname === 'string') ? file.originalname : 'unknown'
    const size = (file && typeof file.size === 'number') ? file.size : (file?.buffer?.length || undefined)
    this.logger.log(`[ImportPDF] start file=${name} size=${size ?? 'n/a'}`)
    const data = await this.parser.parsePdf(file)
    // After parsing, ensure sections are ordered and classify into known vs unknown
    const knownTypes = new Set(['summary', 'experience', 'education', 'skills', 'achievements', 'projects', 'certifications', 'leadership'])
    const sections = (Array.isArray((data as any)?.sections) ? (data as any).sections : []).map((s: any, idx: number) => ({ ...s, order: typeof s?.order === 'number' ? s.order : idx }))
    const ordered = [...sections].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    const additional = ordered.filter((s: any) => !knownTypes.has(String(s?.type)))
    const filtered = ordered.filter((s: any) => knownTypes.has(String(s?.type)))
    ;(data as any).sections = filtered
    ;(data as any).additional_section = additional
    const secCount = Array.isArray((data as any)?.sections) ? (data as any).sections.length : 0
    this.logger.log(`[ImportPDF] done file=${name} duration_ms=${Date.now() - start} sections=${secCount}`)
    return data
  }

  // --- Export ---
  @Get(':id/export')
  async export(@Param('id') id: string, @CurrentUser() user: RequestUser, @Res() res: Response, @Query('format') format?: 'pdf' | 'docx') {
    const resume = await this.resumesService.findOne(id, user.userId)
    if (!resume) throw new Error('Resume not found')
    const fmt = (format || 'pdf').toLowerCase()
    if (fmt === 'docx') {
      const buf = await this.exporter.toDocx(resume)
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')
      res.setHeader('Content-Disposition', `attachment; filename="resume-${resume.id}.docx"`)
      return res.send(buf)
    } else {
      // Pass through the user's bearer token to render the frontend print route for pixel-perfect export
      const authHeader = (res.req.headers['authorization'] as string | undefined) || ''
      const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : undefined
      const buf = await this.exporter.toPdf(resume, token)
      res.setHeader('Content-Type', 'application/pdf')
      res.setHeader('Content-Disposition', `attachment; filename="resume-${resume.id}.pdf"`)
      return res.send(buf)
    }
  }
}

function isValidResumeSeed(input: any): boolean {
  try {
    if (!input || typeof input !== 'object') return false
    const pi = input.personal_info || {}
    // Require at least name and email
    if (!pi || typeof pi !== 'object' || !stringNonEmpty(pi.fullName) || !stringNonEmpty(pi.email)) return false

    // Summary must exist and be non-empty
    if (!stringNonEmpty(input.summary)) return false

    // Education must have at least one item with a non-empty school
    if (!Array.isArray(input.education) || input.education.length === 0) return false
    if (!stringNonEmpty(input.education[0]?.school)) return false

    // Technologies must include at least one group with 3+ skills
    if (!Array.isArray(input.technologies) || input.technologies.length === 0) return false
    const firstGroup = input.technologies[0]
    if (!Array.isArray(firstGroup?.skills) || firstGroup.skills.filter(stringNonEmpty).length < 3) return false

    // Sections must include required blocks
    const sections = Array.isArray(input.sections) ? input.sections : []
    const byType: Map<string, any> = new Map(sections.map((s: any) => [s?.type, s]))
    const summarySection: any = byType.get('summary') || {}
    const experienceSection: any = byType.get('experience') || {}
    const educationSection: any = byType.get('education') || {}
    const skillsSection: any = byType.get('skills') || {}

    if (!summarySection || !stringNonEmpty(summarySection?.content?.text)) return false
    const expItems = Array.isArray(experienceSection?.content) ? experienceSection.content : []
    if (expItems.length === 0) return false
    const firstExp = expItems[0] || {}
    if (!(stringNonEmpty(firstExp.role) || stringNonEmpty(firstExp.company))) return false
    if (!Array.isArray(firstExp.bullets) || firstExp.bullets.filter(stringNonEmpty).length === 0) return false

    const eduItems = Array.isArray(educationSection?.content) ? educationSection.content : []
    if (eduItems.length === 0 || !stringNonEmpty(eduItems[0]?.school)) return false

    const skillsGroups = skillsSection?.content?.groups
    if (!Array.isArray(skillsGroups) || skillsGroups.length === 0) return false
    if (!Array.isArray(skillsGroups[0]?.skills) || skillsGroups[0].skills.filter(stringNonEmpty).length < 3) return false

    return true
  } catch {
    return false
  }
}

function stringNonEmpty(v: any): boolean {
  return typeof v === 'string' && v.trim().length > 0
}
