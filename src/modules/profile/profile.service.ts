import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { UserProfile } from '../../schema/user-profile.entity'

@Injectable()
export class ProfileService {
  constructor(@InjectRepository(UserProfile) private readonly repo: Repository<UserProfile>) {}

  async get(userId: string) {
    const existing = await this.repo.findOne({ where: { user_id: userId } })
    if (existing) return existing
    // Create row if missing; tolerate race by using ON CONFLICT DO NOTHING
    await this.repo
      .createQueryBuilder()
      .insert()
      .into(UserProfile)
      .values({ user_id: userId })
      .onConflict('("user_id") DO NOTHING')
      .execute()
    return (await this.repo.findOne({ where: { user_id: userId } })) as UserProfile
  }

  async update(userId: string, body: { notice_period_days?: number | null; earliest_join_date?: string | null }) {
    const p = await this.get(userId)
    if (body.notice_period_days !== undefined) p.notice_period_days = body.notice_period_days as any
    if (body.earliest_join_date !== undefined) p.earliest_join_date = body.earliest_join_date as any
    return this.repo.save(p)
  }
}


