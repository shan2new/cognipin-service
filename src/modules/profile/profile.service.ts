import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { UserProfile } from '../../schema/user-profile.entity'

@Injectable()
export class ProfileService {
  constructor(@InjectRepository(UserProfile) private readonly repo: Repository<UserProfile>) {}

  async get(userId: string) {
    const existing = await this.repo.findOne({ where: { user_id: userId }, relations: ['company'] })
    if (existing) return existing
    // Create row if missing; tolerate race by using ON CONFLICT DO NOTHING
    await this.repo
      .createQueryBuilder()
      .insert()
      .into(UserProfile)
      .values({ user_id: userId })
      .onConflict('("user_id") DO NOTHING')
      .execute()
    return (await this.repo.findOne({ where: { user_id: userId }, relations: ['company'] })) as UserProfile
  }

  async update(
    userId: string,
    body: {
      notice_period_days?: number | null
      earliest_join_date?: string | null
      theme?: 'light' | 'dark' | null
      current_role?: string | null
      current_company?: string | null
      current_company_id?: string | null
      persona?: 'student' | 'intern' | 'professional' | null
      persona_info?: any | null
      linkedin_url?: string | null
    },
  ) {
    const p = await this.get(userId)
    if (body.notice_period_days !== undefined) p.notice_period_days = body.notice_period_days as any
    if (body.earliest_join_date !== undefined) p.earliest_join_date = body.earliest_join_date as any
    if (body.theme !== undefined) p.theme = body.theme as any
    if (body.current_role !== undefined) p.current_role = body.current_role as any
    if (body.current_company !== undefined) p.current_company = body.current_company as any
    if (body.current_company_id !== undefined) p.current_company_id = body.current_company_id as any
    if (body.persona !== undefined) p.persona = body.persona as any
    if (body.persona_info !== undefined) p.persona_info = body.persona_info as any
    if (body.linkedin_url !== undefined) p.linkedin_url = body.linkedin_url as any
    await this.repo.save(p)
    return this.get(userId)
  }
}
