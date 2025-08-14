import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Between, MoreThanOrEqual, Repository } from 'typeorm'
import { Application } from '../../schema/application.entity'
import { Conversation } from '../../schema/conversation.entity'
import { InterviewRound } from '../../schema/interview-round.entity'

function windowRange(ws?: string, we?: string): { start: Date; end: Date } {
  const end = we ? new Date(we) : new Date()
  const start = ws ? new Date(ws) : new Date(end.getTime() - 30 * 24 * 3600 * 1000)
  return { start, end }
}

@Injectable()
export class AnalyticsService {
  constructor(
    @InjectRepository(Application) private readonly appRepo: Repository<Application>,
    @InjectRepository(Conversation) private readonly convRepo: Repository<Conversation>,
    @InjectRepository(InterviewRound) private readonly roundRepo: Repository<InterviewRound>,
  ) {}

  async funnel(userId: string, ws?: string, we?: string) {
    const { start, end } = windowRange(ws, we)
    const apps = await this.appRepo.find({ where: { user_id: userId, created_at: Between(start, end) } as any })
    const counts = { exploration: 0, interviewing: 0, post_interview: 0 }
    for (const a of apps) counts[a.milestone as keyof typeof counts]++
    return counts
  }

  async aging(userId: string, opts: { stage?: string; gtDays?: number; ws?: string; we?: string }) {
    const { start, end } = windowRange(opts.ws, opts.we)
    const all = await this.appRepo.find({ where: { user_id: userId, created_at: Between(start, end) } as any })
    const now = new Date().getTime()
    const filtered = all.filter((a) => (opts.stage ? a.stage === opts.stage : true))
    const result = filtered
      .map((a) => ({ id: a.id, stage: a.stage, time_in_stage_days: Math.floor((now - a.last_activity_at.getTime()) / 86400000) }))
      .filter((r) => (opts.gtDays ? r.time_in_stage_days > opts.gtDays : true))
    return result
  }

  async platforms(userId: string, ws?: string, we?: string) {
    const { start, end } = windowRange(ws, we)
    const apps = await this.appRepo.find({ where: { user_id: userId, created_at: Between(start, end) } as any })
    const byPlatform: Record<string, any> = {}
    for (const a of apps) {
      const key = a.platform_id || 'unassigned'
      byPlatform[key] ||= { totals: 0, offers: 0, rejects: 0, in_progress: 0, outreach_per_week: [], applied_response_rate: { pct: 0, num: 0, den: 0 }, avg_conversation_pace_days: { value: null as number | null, n: 0 }, comp_snapshot: { median_ctc_mid: null as number | null, iqr: null as number | null } }
      const bucket = byPlatform[key]
      bucket.totals++
      if (a.stage === 'offer') bucket.offers++
      if (a.stage === 'rejected') bucket.rejects++
      if (!['offer', 'rejected', 'accepted'].includes(a.stage)) bucket.in_progress++
    }
    return Object.entries(byPlatform).map(([platform_id, stats]) => ({ platform_id, ...stats }))
  }
}


