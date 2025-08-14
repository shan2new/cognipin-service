import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { Application, ApplicationStage } from '../../schema/application.entity'
import { ApplicationCompensation } from '../../schema/application-compensation.entity'
import { Company } from '../../schema/company.entity'
import { deriveMilestone, canTransition } from '../../lib/stage-machine'
import { computeCtc } from '../../lib/compensation'
import { fetchMetadata } from '../../lib/metadata-fetcher'
import { StageHistory } from '../../schema/stage-history.entity'
import { ApplicationQASnapshot } from '../../schema/application-qa-snapshot.entity'

@Injectable()
export class ApplicationsService {
  constructor(
    @InjectRepository(Application) private readonly appRepo: Repository<Application>,
    @InjectRepository(ApplicationCompensation) private readonly compRepo: Repository<ApplicationCompensation>,
    @InjectRepository(Company) private readonly companyRepo: Repository<Company>,
    @InjectRepository(StageHistory) private readonly historyRepo: Repository<StageHistory>,
    @InjectRepository(ApplicationQASnapshot) private readonly qaRepo: Repository<ApplicationQASnapshot>,
  ) {}

  async list(userId: string, q: Record<string, string | undefined>) {
    const qb = this.appRepo.createQueryBuilder('a')
    qb.where('a.user_id = :userId', { userId })
    qb.leftJoinAndSelect('a.company', 'c')
    // Filters to be expanded later; ensure ordering by last activity desc default
    qb.orderBy('a.last_activity_at', 'DESC')
    const apps = await qb.getMany()
    // Minimal derive placeholder; return as-is including selected relations
    return apps
  }

  async ensureCompany(companyInput: { website_url?: string; company_id?: string }): Promise<Company> {
    if (companyInput.company_id) {
      const c = await this.companyRepo.findOne({ where: { id: companyInput.company_id } })
      if (!c) throw new BadRequestException('Invalid company_id')
      return c
    }
    if (!companyInput.website_url) throw new BadRequestException('company.website_url or company_id required')
    const meta = await fetchMetadata(companyInput.website_url)
    let c = await this.companyRepo.findOne({ where: { website_url: meta.canonicalHost } })
    if (!c) {
      c = this.companyRepo.create({ website_url: meta.canonicalHost, name: meta.name || meta.canonicalHost, logo_blob_base64: meta.logoBase64 })
    } else {
      if (meta.name && !c.name) c.name = meta.name
      if (meta.logoBase64 && !c.logo_blob_base64) c.logo_blob_base64 = meta.logoBase64
    }
    return this.companyRepo.save(c)
  }

  async create(
    userId: string,
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
    const company = await this.ensureCompany(body.company)
    const stage: ApplicationStage =
      body.source === 'applied_self' ? 'applied_self' : body.source === 'applied_referral' ? 'applied_referral' : 'recruiter_outreach'
    const milestone = deriveMilestone(stage)
    const now = new Date()
    const app = this.appRepo.create({
      user_id: userId,
      company_id: company.id,
      role: body.role,
      job_url: body.job_url,
      platform_id: body.platform_id ?? null,
      source: body.source as any,
      stage,
      milestone,
      last_activity_at: now,
    })
    const saved = await this.appRepo.save(app)
    if (body.compensation) {
      const comp = this.compRepo.create({
        application_id: saved.id,
        fixed_min_lpa: body.compensation.fixed_min_lpa?.toString() ?? null,
        fixed_max_lpa: body.compensation.fixed_max_lpa?.toString() ?? null,
        var_min_lpa: body.compensation.var_min_lpa?.toString() ?? null,
        var_max_lpa: body.compensation.var_max_lpa?.toString() ?? null,
        tentative_ctc_note: body.compensation.note ?? null,
      })
      await this.compRepo.save(comp)
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
    return saved
  }

  async getById(userId: string, id: string) {
    const app = await this.appRepo.findOne({ where: { id, user_id: userId } })
    if (!app) throw new NotFoundException('Application not found')
    const [comp, qa] = await Promise.all([
      this.compRepo.findOne({ where: { application_id: id } }),
      this.qaRepo.findOne({ where: { application_id: id } }),
    ])
    return { ...app, compensation: comp ?? null, qa_snapshot: qa ?? null }
  }

  async update(
    userId: string,
    id: string,
    body: Partial<{
      role: string
      platform_id: string | null
      source: string
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
    const app = await this.getById(userId, id)
    if (body.role !== undefined) app.role = body.role
    if (body.platform_id !== undefined) app.platform_id = body.platform_id
    if (body.source !== undefined) app.source = body.source as any
    if (body.notes !== undefined) app.notes = body.notes
    if (body.resume_variant !== undefined) app.resume_variant = body.resume_variant
    const saved = await this.appRepo.save(app)

    if (body.compensation) {
      let comp = await this.compRepo.findOne({ where: { application_id: id } })
      if (!comp) comp = this.compRepo.create({ application_id: id })
      comp.fixed_min_lpa = body.compensation.fixed_min_lpa === undefined ? comp.fixed_min_lpa : body.compensation.fixed_min_lpa?.toString() ?? null
      comp.fixed_max_lpa = body.compensation.fixed_max_lpa === undefined ? comp.fixed_max_lpa : body.compensation.fixed_max_lpa?.toString() ?? null
      comp.var_min_lpa = body.compensation.var_min_lpa === undefined ? comp.var_min_lpa : body.compensation.var_min_lpa?.toString() ?? null
      comp.var_max_lpa = body.compensation.var_max_lpa === undefined ? comp.var_max_lpa : body.compensation.var_max_lpa?.toString() ?? null
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
    return saved
  }

  async transition(userId: string, id: string, body: { to_stage: ApplicationStage; reason?: string; admin_override?: boolean }) {
    const app = await this.getById(userId, id)
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
    return saved
  }

  async getStageHistory(userId: string, id: string) {
    await this.getById(userId, id)
    return this.historyRepo.find({ where: { application_id: id }, order: { changed_at: 'DESC' } })
  }
}


