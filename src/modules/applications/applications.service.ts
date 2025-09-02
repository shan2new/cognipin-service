import { Injectable, BadRequestException, UnauthorizedException, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Brackets, Repository } from 'typeorm'

import { Application, ApplicationMilestone, ApplicationStage } from '../../schema/application.entity'
import { Company } from '../../schema/company.entity'
import { Platform } from '../../schema/platform.entity'
import { StageHistory } from '../../schema/stage-history.entity'
import { ApplicationQASnapshot } from '../../schema/application-qa-snapshot.entity'
import { ApplicationContact } from '../../schema/application-contact.entity'
import { ApplicationCompensation } from '../../schema/application-compensation.entity'
import { ApplicationNote } from '../../schema/application-note.entity'
import { Conversation } from '../../schema/conversation.entity'
import { InterviewRound } from '../../schema/interview-round.entity'
import { canTransition, deriveMilestone, isInterviewRoundStage } from '../../lib/stage-machine'
import { StageObject } from '../../schema/application-stage.dto'
import { computeCtc } from '../../lib/compensation'
import { fetchMetadata } from '../../lib/metadata-fetcher'
import { R2StorageService } from '../../lib/r2-storage.service'
import { PlatformsService } from '../platforms/platforms.service'

@Injectable()
export class ApplicationsService {
  constructor(
    @InjectRepository(Application) private readonly appRepo: Repository<Application>,
    @InjectRepository(ApplicationCompensation) private readonly compRepo: Repository<ApplicationCompensation>,
    @InjectRepository(Company) private readonly companyRepo: Repository<Company>,
    @InjectRepository(StageHistory) private readonly historyRepo: Repository<StageHistory>,
    @InjectRepository(ApplicationQASnapshot) private readonly qaRepo: Repository<ApplicationQASnapshot>,
    @InjectRepository(ApplicationContact) private readonly appContactRepo: Repository<ApplicationContact>,
    @InjectRepository(ApplicationNote) private readonly noteRepo: Repository<ApplicationNote>,
    @InjectRepository(Conversation) private readonly convoRepo: Repository<Conversation>,
    @InjectRepository(InterviewRound) private readonly interviewRepo: Repository<InterviewRound>,
    private readonly r2: R2StorageService,
    private readonly platformsSvc: PlatformsService,
  ) {}

  private async formatStageAsObject(stage: ApplicationStage, applicationId: string): Promise<StageObject> {
    if (isInterviewRoundStage(stage)) {
      // Extract round number from stage (e.g., 'interview_round_1' -> 1)
      const match = stage.match(/interview_round_(\d+)/)
      const roundNumber = match ? parseInt(match[1]) : 1
      // Fetch only the specific interview round using the composite index (application_id, round_index)
      const interviewRound = await this.interviewRepo.findOne({
        where: { application_id: applicationId, round_index: roundNumber },
      })
      
      return {
        id: stage,
        name: `Interview Round ${roundNumber}`,
        type: 'interview_round',
        interview_round_number: roundNumber,
        interview_data: interviewRound ? {
          type: interviewRound.type,
          custom_name: interviewRound.custom_name || undefined,
          status: interviewRound.status,
          scheduled_at: interviewRound.scheduled_at?.toISOString(),
          completed_at: interviewRound.completed_at?.toISOString(),
          result: interviewRound.result || undefined,
          rejection_reason: interviewRound.rejection_reason || undefined,
        } : undefined
      }
    } else {
      // For standard stages, create a simple stage object
      const stageNames: Record<string, string> = {
        'wishlist': 'Wishlist',
        'recruiter_reachout': 'Recruiter Reachout', 
        'self_review': 'Self Review',
        'hr_shortlist': 'HR Shortlist',
        'hm_shortlist': 'Manager Shortlist',
        'offer': 'Offer'
      }
      
      return {
        id: stage,
        name: stageNames[stage] || stage,
        type: 'standard'
      }
    }
  }

  async list(userId: string, q: Record<string, string | undefined>) {
    const qb = this.appRepo.createQueryBuilder('a')
    qb.where('a.user_id = :userId', { userId })
    qb.leftJoinAndSelect('a.company', 'c')
    qb.leftJoinAndSelect('a.platform', 'p')
    qb.leftJoinAndSelect('a.compensation', 'comp')
    // Basic filters (expand as needed)
    if (q.platform_id) {
      qb.andWhere('a.platform_id = :platform_id', { platform_id: q.platform_id })
    }
    if (q.stage) {
      qb.andWhere('a.stage = :stage', { stage: q.stage })
    }
    if (q.milestone) {
      qb.andWhere('a.milestone = :milestone', { milestone: q.milestone })
    }
    if (q.source) {
      qb.andWhere('a.source = :source', { source: q.source })
    }
    if (q.status) {
      qb.andWhere('a.status = :status', { status: q.status })
    }
    if (q.date_from) {
      const df = new Date(q.date_from)
      if (!isNaN(df.getTime())) qb.andWhere('a.last_activity_at >= :date_from', { date_from: df })
    }
    if (q.date_to) {
      const dt = new Date(q.date_to)
      if (!isNaN(dt.getTime())) qb.andWhere('a.last_activity_at <= :date_to', { date_to: dt })
    }
    // Ensure ordering by last activity desc default
    qb.orderBy('a.last_activity_at', 'DESC')
    const apps = await qb.getMany()
    
    // Format stages as objects for all applications
    const formattedApps = await Promise.all(
      apps.map(async (app) => ({
        ...app,
        stage: await this.formatStageAsObject(app.stage, app.id)
      }))
    )
    
    return formattedApps
  }

  async ensureCompany(companyInput: { website_url?: string; company_id?: string }): Promise<Company> {
    if (companyInput.company_id) {
      const c = await this.companyRepo.findOne({ where: { id: companyInput.company_id } })
      if (!c) throw new BadRequestException('Invalid company_id')
      return c
    }
    if (!companyInput.website_url) throw new BadRequestException('company.website_url or company_id required')
    // Normalize to origin to avoid path fragments from job URLs
    try {
      const u = new URL(companyInput.website_url)
      companyInput.website_url = `${u.protocol}//${u.hostname}`
    } catch {}
    // Fetch metadata first so we can query by canonicalHost and keep logo/name fresh
    const meta = await fetchMetadata(companyInput.website_url)
    let c = await this.companyRepo.findOne({ where: { website_url: meta.canonicalHost } })
    if (!c) {
      c = this.companyRepo.create({ website_url: meta.canonicalHost, name: meta.name || meta.canonicalHost })
      if (meta.logoBase64) {
        try {
          const host = (() => { try { return new URL(meta.canonicalHost).hostname } catch { return meta.canonicalHost.replace(/^https?:\/\//, '') } })()
          const keyPrefix = `logos/company/${host}/logo`
          c.logo_url = await this.r2.uploadBase64Image(meta.logoBase64, keyPrefix)
        } catch (e) {
          // non-blocking
        }
      }
    } else {
      if (meta.name && !c.name) c.name = meta.name
      // Always replace logo and overwrite in R2 whenever base64 is present
      if (meta.logoBase64) {
        try {
          const host = (() => { try { return new URL(meta.canonicalHost).hostname } catch { return meta.canonicalHost.replace(/^https?:\/\//, '') } })()
          const keyPrefix = `logos/company/${host}/logo`
          c.logo_url = await this.r2.uploadBase64Image(meta.logoBase64, keyPrefix)
        } catch (e) {
          // non-blocking
        }
      }
    }
    return this.companyRepo.save(c)
  }

  async create(
    userId: string,
    body: {
      company: { website_url?: string; company_id?: string }
      role: string
      job_url?: string | null
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
    const company = await this.ensureCompany(body.company)
    const stage: ApplicationStage =
      body.source === 'applied_self' ? 'self_review' : body.source === 'applied_referral' ? 'self_review' : 'recruiter_reachout'
    const milestone = deriveMilestone(stage)
    const now = new Date()
    const app = this.appRepo.create({
      user_id: userId,
      company_id: company.id,
      role: body.role,
      job_url: body.job_url ?? null,
      platform_id: body.platform_id ?? null,
      source: body.source as any,
      stage,
      milestone,
      last_activity_at: now,
    })
    const saved = await this.appRepo.save(app)
    if (saved.platform_id) {
      try { await this.platformsSvc.ensureUserPlatform(userId, saved.platform_id) } catch {}
    }
    if (body.compensation) {
      const sanitize = (v?: any): string | null => {
        if (v === undefined || v === null) return null
        let n = typeof v === 'number' ? v : parseFloat(String(v).replace(/[^0-9.]/g, ''))
        if (!isFinite(n)) return null
        // Clamp to DECIMAL(6,2) max 9999.99; drop if out of range
        if (n > 9999.99 || n < 0) return null
        return n.toFixed(2)
      }
      const comp = this.compRepo.create({
        application_id: saved.id,
        fixed_min_lpa: sanitize(body.compensation.fixed_min_lpa),
        fixed_max_lpa: sanitize(body.compensation.fixed_max_lpa),
        var_min_lpa: sanitize(body.compensation.var_min_lpa),
        var_max_lpa: sanitize(body.compensation.var_max_lpa),
        tentative_ctc_note: body.compensation.note ?? null,
      })
      // Only persist if any numeric field or note is present
      if (
        comp.fixed_min_lpa !== null ||
        comp.fixed_max_lpa !== null ||
        comp.var_min_lpa !== null ||
        comp.var_max_lpa !== null ||
        comp.tentative_ctc_note !== null
      ) {
        await this.compRepo.save(comp)
      }
    }
    // QA snapshot: copy from provided; if omitted, leave nulls (profile copy can be added later)
    const snap = this.qaRepo.create({
      application_id: saved.id,
      current_ctc_text: body.qa_snapshot?.current_ctc_text ?? null,
      expected_ctc_text: body.qa_snapshot?.expected_ctc_text ?? null,
      notice_period_text: body.qa_snapshot?.notice_period_text ?? null,
      reason_leaving_current_text: body.qa_snapshot?.reason_leaving_current_text ?? null,
      past_leaving_reasons_text: body.qa_snapshot?.past_leaving_reasons_text ?? null,
    })
    await this.qaRepo.save(snap)
    // Return hydrated application with relations for consistency with GET/PATCH
    return this.getById(userId, saved.id)
  }

  async getById(userId: string, id: string) {
    // Load company/platform relations to keep API responses consistent
    const app = await this.appRepo.findOne({ where: { id, user_id: userId }, relations: ['company', 'platform'] })
    if (!app) throw new NotFoundException('Application not found')
    const [comp, qa, stageObject] = await Promise.all([
      this.compRepo.findOne({ where: { application_id: id } }),
      this.qaRepo.findOne({ where: { application_id: id } }),
      this.formatStageAsObject(app.stage, app.id)
    ])
    return { ...app, stage: stageObject, compensation: comp ?? null, qa_snapshot: qa ?? null }
  }

  async update(
    userId: string,
    id: string,
    body: Partial<{
      company: { website_url?: string; company_id?: string }
      company_id: string
      role: string
      job_url: string | null
      platform_id: string | null
      source: string
      stage: string | null
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
    // Load a clean entity (no relations) to avoid relation object overriding FK during save
    const appEntity = await this.appRepo.findOne({ where: { id, user_id: userId } })
    if (!appEntity) throw new NotFoundException('Application not found')
    const app = appEntity
    // Company change
    if (body.company) {
      const company = await this.ensureCompany(body.company)
      app.company_id = company.id
      // Ensure no stale relation object persists
      ;(app as any).company = undefined
    }
    if (body.company_id) {
      const company = await this.companyRepo.findOne({ where: { id: body.company_id } })
      if (!company) throw new BadRequestException('Invalid company_id')
      app.company_id = company.id
      ;(app as any).company = undefined
    }
    if (body.role !== undefined) app.role = body.role
    if ('job_url' in body) app.job_url = body.job_url ?? null
    if (body.platform_id !== undefined) app.platform_id = body.platform_id
    if (body.source !== undefined) app.source = body.source as any
    if (body.stage !== undefined) app.stage = body.stage as any
    if (body.notes !== undefined) app.notes = body.notes
    if (body.resume_variant !== undefined) app.resume_variant = body.resume_variant
    const saved = await this.appRepo.save(app)
    if (body.platform_id) {
      try { await this.platformsSvc.ensureUserPlatform(userId, body.platform_id) } catch {}
    }

    if (body.compensation) {
      let comp = await this.compRepo.findOne({ where: { application_id: id } })
      if (!comp) comp = this.compRepo.create({ application_id: id })
      // Sanitize compensation values to prevent "Unknown" or invalid strings
      const sanitize = (v?: any): string | null => {
        if (v === undefined || v === null) return null
        if (typeof v === 'string' && (v.toLowerCase() === 'unknown' || v.trim() === '')) return null
        let n = typeof v === 'number' ? v : parseFloat(String(v).replace(/[^0-9.]/g, ''))
        if (!isFinite(n)) return null
        // Clamp to DECIMAL(6,2) max 9999.99; drop if out of range
        if (n > 9999.99 || n < 0) return null
        return n.toFixed(2)
      }
      
      comp.fixed_min_lpa = body.compensation.fixed_min_lpa === undefined ? comp.fixed_min_lpa : sanitize(body.compensation.fixed_min_lpa)
      comp.fixed_max_lpa = body.compensation.fixed_max_lpa === undefined ? comp.fixed_max_lpa : sanitize(body.compensation.fixed_max_lpa)
      comp.var_min_lpa = body.compensation.var_min_lpa === undefined ? comp.var_min_lpa : sanitize(body.compensation.var_min_lpa)
      comp.var_max_lpa = body.compensation.var_max_lpa === undefined ? comp.var_max_lpa : sanitize(body.compensation.var_max_lpa)
      comp.tentative_ctc_note = body.compensation.note === undefined ? comp.tentative_ctc_note : body.compensation.note ?? null
      await this.compRepo.save(comp)
    }
    if (body.qa_snapshot) {
      let snap = await this.qaRepo.findOne({ where: { application_id: id } })
      if (!snap) snap = this.qaRepo.create({ application_id: id })
      if ('current_ctc_text' in body.qa_snapshot) snap.current_ctc_text = body.qa_snapshot.current_ctc_text ?? null
      if ('expected_ctc_text' in body.qa_snapshot) snap.expected_ctc_text = body.qa_snapshot.expected_ctc_text ?? null
      if ('notice_period_text' in body.qa_snapshot) snap.notice_period_text = body.qa_snapshot.notice_period_text ?? null
      if ('reason_leaving_current_text' in body.qa_snapshot) snap.reason_leaving_current_text = body.qa_snapshot.reason_leaving_current_text ?? null
      if ('past_leaving_reasons_text' in body.qa_snapshot) snap.past_leaving_reasons_text = body.qa_snapshot.past_leaving_reasons_text ?? null
      await this.qaRepo.save(snap)
    }
    // Return hydrated application with relations for consistency with GET/POST
    return this.getById(userId, id)
  }

  async transition(userId: string, id: string, body: { to_stage: ApplicationStage; reason?: string; admin_override?: boolean }) {
    // Get the raw application entity (with string stage) for database operations
    const app = await this.appRepo.findOne({ where: { id, user_id: userId } })
    if (!app) throw new NotFoundException('Application not found')
    
    if (!canTransition(app.stage, body.to_stage, body.admin_override)) {
      throw new BadRequestException('Invalid stage transition')
    }
    
    const from = app.stage
    app.stage = body.to_stage
    app.milestone = deriveMilestone(app.stage)
    app.last_activity_at = new Date()
    const saved = await this.appRepo.save(app)
    await this.historyRepo.save(
      this.historyRepo.create({
        application_id: id,
        from_stage: from,
        to_stage: app.stage,
        reason: body.reason ?? null,
        by: 'user',
      }),
    )
    
    // Return formatted response with stage object
    return this.getById(userId, id)
  }

  async getStageHistory(userId: string, id: string) {
    await this.getById(userId, id)
    return this.historyRepo.find({ where: { application_id: id }, order: { changed_at: 'DESC' } })
  }

  async delete(userId: string, id: string) {
    // Ensure the application exists and belongs to the user
    await this.getById(userId, id)
    // Delete child/dependent rows first
    await Promise.all([
      this.compRepo.delete({ application_id: id }),
      this.qaRepo.delete({ application_id: id }),
      this.historyRepo.delete({ application_id: id }),
      this.appContactRepo.delete({ application_id: id }),
      this.convoRepo.delete({ application_id: id }),
      this.interviewRepo.delete({ application_id: id }),
      this.noteRepo.delete({ application_id: id }),
    ])
    // Finally delete the application
    await this.appRepo.delete({ id, user_id: userId })
  }
  
  // Application Notes methods
  async createNote(userId: string, applicationId: string, content: string) {
    // Verify the application exists and belongs to the user
    await this.getById(userId, applicationId)
    
    const note = this.noteRepo.create({
      application_id: applicationId,
      user_id: userId,
      content,
    })
    
    // Update the application's last_activity_at timestamp
    await this.appRepo.update(
      { id: applicationId, user_id: userId },
      { last_activity_at: new Date() }
    )
    
    return this.noteRepo.save(note)
  }
  
  async getNotes(userId: string, applicationId: string) {
    // Verify the application exists and belongs to the user
    await this.getById(userId, applicationId)
    
    // Return notes ordered by creation date (newest first)
    return this.noteRepo.find({
      where: { application_id: applicationId },
      order: { created_at: 'DESC' }
    })
  }
  
  async deleteNote(userId: string, noteId: string) {
    // Find the note
    const note = await this.noteRepo.findOne({ where: { id: noteId } })
    if (!note) throw new NotFoundException('Note not found')
    
    // Verify the application belongs to the user
    await this.getById(userId, note.application_id)
    
    await this.noteRepo.delete({ id: noteId })
    return { deleted: true, id: noteId }
  }
}


