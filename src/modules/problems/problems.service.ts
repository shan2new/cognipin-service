import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { Problem } from '../../schema/problem.entity'
import { ProblemProgress } from '../../schema/problem-progress.entity'

interface FindAllParams {
  userId: string
  q?: string
  difficulty?: 'Easy' | 'Medium' | 'Hard'
  topics?: string[]
  status?: 'Not Started' | 'Attempted' | 'Solved'
  page?: number
  limit?: number
}

interface CountParams {
  userId: string
  q?: string
  topics?: string[]
  status?: 'Not Started' | 'Attempted' | 'Solved'
}

@Injectable()
export class ProblemsService {
  constructor(
    @InjectRepository(Problem) private problemsRepo: Repository<Problem>,
    @InjectRepository(ProblemProgress) private progressRepo: Repository<ProblemProgress>
  ) {}

  async findAll(params: FindAllParams) {
    const { userId, q, difficulty, topics, status } = params
    const page = Math.max(1, Math.floor(params.page ?? 1))
    const limit = Math.min(100, Math.max(1, Math.floor(params.limit ?? 10)))
    const skip = (page - 1) * limit
    let qb = this.problemsRepo
      .createQueryBuilder('p')
      .leftJoin(ProblemProgress, 'pr', 'pr.problem_id = p.id AND pr.user_id = :userId', { userId })
      .leftJoin('p.topic', 't')
      .leftJoin('p.subtopic', 's')

    if (q && q.trim()) {
      qb = qb.andWhere('p.name ILIKE :q', { q: `%${q.trim()}%` })
    }
    if (difficulty) {
      qb = qb.andWhere('p.difficulty = :difficulty', { difficulty })
    }
    if (topics && topics.length > 0) {
      // Filter by topic_id to leverage (difficulty, topic_id) or (topic_id, subtopic_id) indexes
      qb = qb.andWhere(
        'p.topic_id IN (SELECT id FROM topics WHERE title IN (:...topics))',
        { topics }
      )
    }
    if (status) {
      if (status === 'Attempted' || status === 'Solved') {
        // Uses problem_progress (user_id, status) index
        qb = qb.andWhere('pr.status = :status', { status })
      } else if (status === 'Not Started') {
        // Prefer NOT EXISTS to leverage (user_id, status, problem_id) composite index
        qb = qb.andWhere(
          `NOT EXISTS (
            SELECT 1 FROM problem_progress pr2
            WHERE pr2.problem_id = p.id AND pr2.user_id = :userId2 AND pr2.status IN ('Attempted','Solved')
          )`,
          { userId2: userId }
        )
      }
    }

    const total = await qb.clone().select('p.id').distinct(true).getCount()

    const rows = await qb
      .select([
        'p.id AS id',
        'p.name AS name',
        'p.url AS url',
        'p.difficulty AS difficulty',
        't.title AS topic',
        's.title AS subtopic',
      ])
      // Order by ids to align with (topic_id, subtopic_id) composite index
      .orderBy('p.topic_id', 'ASC')
      .addOrderBy('p.subtopic_id', 'ASC')
      .offset(skip)
      .limit(limit)
      .getRawMany<{
        id: string
        name: string
        url: string
        difficulty: 'Easy' | 'Medium' | 'Hard'
        topic: string
        subtopic: string
      }>()

    const items = rows.map((r) => ({
      id: r.id,
      name: r.name,
      url: r.url,
      difficulty: r.difficulty,
      topic: r.topic,
      subtopic: r.subtopic,
    }))
    return { items, total, page, limit }
  }

  async getDifficultyCounts(params: CountParams) {
    const { userId, q, topics, status } = params
    let qb = this.problemsRepo
      .createQueryBuilder('p')
      .leftJoin(ProblemProgress, 'pr', 'pr.problem_id = p.id AND pr.user_id = :userId', { userId })

    if (q && q.trim()) {
      qb = qb.andWhere('p.name ILIKE :q', { q: `%${q.trim()}%` })
    }
    if (topics && topics.length > 0) {
      qb = qb.andWhere(
        'p.topic_id IN (SELECT id FROM topics WHERE title IN (:...topics))',
        { topics }
      )
    }
    if (status) {
      if (status === 'Attempted' || status === 'Solved') {
        qb = qb.andWhere('pr.status = :status', { status })
      } else if (status === 'Not Started') {
        qb = qb.andWhere(
          `NOT EXISTS (
            SELECT 1 FROM problem_progress pr2
            WHERE pr2.problem_id = p.id AND pr2.user_id = :userId2 AND pr2.status IN ('Attempted','Solved')
          )`,
          { userId2: userId }
        )
      }
    }

    const rows = await qb
      .select('p.difficulty', 'difficulty')
      .addSelect('COUNT(*)', 'count')
      .groupBy('p.difficulty')
      .getRawMany<{ difficulty: 'Easy' | 'Medium' | 'Hard'; count: string }>()

    const result = { Easy: 0, Medium: 0, Hard: 0 } as Record<'Easy' | 'Medium' | 'Hard', number>
    for (const r of rows) {
      result[r.difficulty] = Number(r.count)
    }
    return result
  }
}


