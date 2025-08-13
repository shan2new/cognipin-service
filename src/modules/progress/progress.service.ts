import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { Problem } from '../../schema/problem.entity'
import { Topic } from '../../schema/topic.entity'
import { ProblemProgress } from '../../schema/problem-progress.entity'

@Injectable()
export class ProgressService {
  constructor(
    @InjectRepository(Problem) private problemsRepo: Repository<Problem>,
    @InjectRepository(ProblemProgress) private progressRepo: Repository<ProblemProgress>
  ) {}

  async upsertStatus(userId: string, problemId: string, status: 'Not Started' | 'Attempted' | 'Solved') {
    const existing = await this.progressRepo.findOne({ where: { userId, problemId } })
    if (existing) {
      existing.status = status
      await this.progressRepo.save(existing)
    } else {
      await this.progressRepo.save(this.progressRepo.create({ userId, problemId, status }))
    }
  }

  async getOverall(userId: string) {
    const total = await this.problemsRepo.count()
    const solved = await this.progressRepo.count({ where: { userId, status: 'Solved' } })
    const percent = total > 0 ? Math.round((solved / total) * 100) : 0
    return { solved, total, percent }
  }

  async getStatusCounts(userId: string) {
    const total = await this.problemsRepo.count()
    const attempted = await this.progressRepo.count({ where: { userId, status: 'Attempted' } })
    const solved = await this.progressRepo.count({ where: { userId, status: 'Solved' } })
    const notStarted = Math.max(total - attempted - solved, 0)
    return { total, attempted, solved, notStarted }
  }

  async getByTopic(userId: string) {
    const problems = await this.problemsRepo
      .createQueryBuilder('p')
      .select(['p.topic_id AS topic_id'])
      .getRawMany<{ topic_id: string }>()
    const totals: Record<string, number> = {}
    for (const r of problems) totals[r.topic_id] = (totals[r.topic_id] ?? 0) + 1
    const qb = this.progressRepo
      .createQueryBuilder('pr')
      .innerJoin(Problem, 'p', 'p.id = pr.problem_id')
      .select('p.topic_id', 'topic_id')
      .addSelect('COUNT(*)', 'solved')
      .where('pr.user_id = :userId AND pr.status = :status', { userId, status: 'Solved' })
      .groupBy('p.topic_id')
    const rows = await qb.getRawMany<{ topic_id: string; solved: string }>()
    const solvedByTopicId: Record<string, number> = {}
    for (const r of rows) solvedByTopicId[r.topic_id] = Number(r.solved)
    // join to titles in one shot
    const titles = await this.progressRepo.query(`
      SELECT id, title FROM topics WHERE id = ANY($1)
    `, [Object.keys(totals)])
    const idToTitle: Record<string, string> = {}
    for (const t of titles) idToTitle[t.id] = t.title
    const items = Object.keys(totals).map((topicId) => ({
      topic: idToTitle[topicId] ?? topicId,
      total: totals[topicId],
      solved: solvedByTopicId[topicId] ?? 0,
    }))
    return { items }
  }
}


