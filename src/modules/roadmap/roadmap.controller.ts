import { Controller, Get, UseGuards } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { Section } from '../../schema/section.entity'
import { ClerkGuard } from '../auth/clerk.guard'

interface RoadmapSectionDto {
  title: string
  topics: string[]
}

@UseGuards(ClerkGuard)
@Controller('roadmap')
export class RoadmapController {
  constructor(@InjectRepository(Section) private sectionsRepo: Repository<Section>) {}

  @Get()
  async getRoadmap() {
    // Fetch sections ordered, then join topics via section_topics
    const rows = await this.sectionsRepo.query(`
      SELECT s.title as section_title, st."order" as topic_order, t.title as topic_title, s."order" as section_order
      FROM sections s
      JOIN section_topics st ON st.section_id = s.id
      JOIN topics t ON t.id = st.topic_id
      ORDER BY s."order" ASC, st."order" ASC
    `)
    const byTitle: Record<string, string[]> = {}
    const sectionOrders: Record<string, number> = {}
    for (const r of rows) {
      const sec = r.section_title as string
      if (!byTitle[sec]) byTitle[sec] = []
      byTitle[sec].push(r.topic_title as string)
      sectionOrders[sec] = Number(r.section_order)
    }
    const sections: RoadmapSectionDto[] = Object.keys(byTitle)
      .sort((a, b) => (sectionOrders[a] ?? 0) - (sectionOrders[b] ?? 0))
      .map((title) => ({ title, topics: byTitle[title] }))
    return { sections }
  }
}


