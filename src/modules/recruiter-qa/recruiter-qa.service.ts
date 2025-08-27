import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { RecruiterQA } from '../../schema/recruiter-qa.entity'
import { RedisService } from '../../lib/redis.service'

@Injectable()
export class RecruiterQAService {
  constructor(
    @InjectRepository(RecruiterQA) private readonly repo: Repository<RecruiterQA>,
    private readonly redis: RedisService,
  ) {}

  async list(userId: string) {
    const items = await this.repo.find({ where: { user_id: userId } })
    const map = Object.fromEntries(items.map((i) => [i.key, i.answer]))
    return {
      current_ctc_text: map.current_ctc || null,
      expected_ctc_text: map.expected_ctc || null,
      notice_period_text: map.notice_period || null,
      reason_leaving_current_text: map.reason_leaving_current || null,
      past_leaving_reasons_text: map.past_leaving_reasons || null,
    }
  }

  async put(
    userId: string,
    body: {
      current_ctc_text?: string
      expected_ctc_text?: string
      notice_period_text?: string
      reason_leaving_current_text?: string
      past_leaving_reasons_text?: string
    },
  ) {
    const upserts: { key: string; value: string }[] = []
    for (const [key, value] of Object.entries(body)) {
      if (value !== undefined) upserts.push({ key: key.replace(/_text$/, ''), value })
    }
    for (const u of upserts) {
      const existing = await this.repo.findOne({ where: { user_id: userId, key: u.key as any } })
      if (existing) {
        existing.answer = u.value
        await this.repo.save(existing)
      } else {
        await this.repo.save(this.repo.create({ user_id: userId, key: u.key as any, answer: u.value }))
      }
    }
    
    // Invalidate QA rehearsal cache when QA data is updated
    await this.redis.delPattern(`qa_rehearsal:${userId}:*`)
    
    return this.list(userId)
  }
}


