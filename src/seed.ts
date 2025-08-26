import 'reflect-metadata'
import fs from 'node:fs'
import path from 'node:path'
import { Problem } from './schema/problem.entity'
import { Topic } from './schema/topic.entity'
import { Subtopic } from './schema/subtopic.entity'
import { Section, SectionTopic } from './schema/section.entity'

// Note: data-source exports a named AppDataSource, but default export was removed earlier.
// Import again explicitly to avoid ambiguity.
import { AppDataSource } from './data-source'

function slugifyFromUrl(name: string, url: string): string {
  try {
    const u = new URL(url)
    const parts = u.pathname.split('/').filter(Boolean)
    const idx = parts.findIndex((p) => p === 'problems')
    if (idx >= 0 && parts[idx + 1]) {
      return parts[idx + 1]
    }
  } catch {
    // Ignore URL parsing errors
  }
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
}

type ParsedProblem = {
  id: string
  name: string
  url: string
  difficulty: 'Easy' | 'Medium' | 'Hard'
  topic: string
  subtopic: string
}

function parseSeedMarkdown(content: string): ParsedProblem[] {
  const lines = content.split(/\r?\n/)
  let currentTopic = ''
  let currentSubtopic = ''
  const results: ParsedProblem[] = []

  for (const line of lines) {
    const topicMatch = line.match(/^##\s+\*\*[0-9]+\.[^*]*\*\*\s*$/)
    if (topicMatch) {
      // Extract between ** ** and remove leading number and dot
      const inner = line.replace(/^##\s+\*\*/, '').replace(/\*\*\s*$/, '').trim()
      const withoutIndex = inner.replace(/^[0-9]+\.\s*/, '').trim()
      currentTopic = withoutIndex
      continue
    }

    const subtopicMatch = line.match(/^###\s+(.+)$/)
    if (subtopicMatch) {
      currentSubtopic = subtopicMatch[1].trim()
      continue
    }

    const problemMatch = line.match(/^-\s+\[(.+?)\]\((https?:[^)]+)\)\s+-\s+(Easy|Medium|Hard)\s*$/)
    if (problemMatch && currentTopic && currentSubtopic) {
      const name = problemMatch[1].trim()
      const url = problemMatch[2].trim()
      const difficulty = problemMatch[3].trim() as ParsedProblem['difficulty']
      const id = slugifyFromUrl(name, url)
      results.push({ id, name, url, difficulty, topic: currentTopic, subtopic: currentSubtopic })
      continue
    }
  }
  return results
}

async function main(): Promise<void> {
  const seedPath = path.resolve(__dirname, '../seed.md')
  if (!fs.existsSync(seedPath)) {
    throw new Error(`Seed file not found at ${seedPath}`)
  }
  const md = fs.readFileSync(seedPath, 'utf8')
  const problems = parseSeedMarkdown(md)
  if (problems.length === 0) {
    throw new Error('No problems parsed from seed.md')
  }

  await AppDataSource.initialize()
  const problemRepo = AppDataSource.getRepository(Problem)
  const topicRepo = AppDataSource.getRepository(Topic)
  const subtopicRepo = AppDataSource.getRepository(Subtopic)
  const sectionRepo = AppDataSource.getRepository(Section)
  const sectionTopicRepo = AppDataSource.getRepository(SectionTopic)

  let inserted = 0
  for (const p of problems) {
    const exists = await problemRepo.findOne({ where: { id: p.id } })
    if (exists) continue
    const topicId = p.topic.toLowerCase().replace(/ & /g, ' and ').replace(/\s+/g, '-')
    let topic = await topicRepo.findOne({ where: { id: topicId } })
    if (!topic) {
      topic = topicRepo.create({ id: topicId, title: p.topic })
      await topicRepo.save(topic)
    }

    const subId = p.subtopic.toLowerCase().replace(/ & /g, ' and ').replace(/\s+/g, '-')
    let subtopic = await subtopicRepo.findOne({ where: { id: subId } })
    if (!subtopic) {
      subtopic = subtopicRepo.create({ id: subId, title: p.subtopic, topicId: topic.id })
      await subtopicRepo.save(subtopic)
    }

    const entity = problemRepo.create({
      id: p.id,
      name: p.name,
      url: p.url,
      difficulty: p.difficulty,
      topicId: topic.id,
      subtopicId: subtopic.id,
    })
    await problemRepo.save(entity)
    inserted += 1
  }

  // Seed roadmap sections and topic ordering if empty
  const existingSections = await sectionRepo.count()
  if (existingSections === 0) {
    const sectionDefs: { title: string; topics: string[] }[] = [
      { title: 'Foundation', topics: ['Arrays & Strings', 'Linked Lists', 'Stacks & Queues', 'Binary Search'] },
      { title: 'Trees & Graphs', topics: ['Trees', 'Heaps/Priority Queues', 'Graphs'] },
      { title: 'Search & Optimize', topics: ['Backtracking', 'Dynamic Programming'] },
      { title: 'Patterns & Structures', topics: ['Greedy Algorithms', 'Tries'] },
      { title: 'Bits & Math', topics: ['Bit Manipulation', 'Math & Miscellaneous'] },
    ]

    let secOrder = 0
    for (const def of sectionDefs) {
      secOrder += 1
      const section = await sectionRepo.save(sectionRepo.create({ title: def.title, order: secOrder }))
      let topicOrder = 0
      for (const tTitle of def.topics) {
        topicOrder += 1
        const topicId = tTitle.toLowerCase().replace(/ & /g, ' and ').replace(/\s+/g, '-')
        let topic = await topicRepo.findOne({ where: { id: topicId } })
        if (!topic) {
          topic = await topicRepo.save(topicRepo.create({ id: topicId, title: tTitle }))
        }
        await sectionTopicRepo.save(
          sectionTopicRepo.create({ sectionId: section.id, topicId: topic.id, order: topicOrder })
        )
      }
    }
  }
  await AppDataSource.destroy()
  // eslint-disable-next-line no-console
  console.log(`Seeded ${inserted} new problems (of ${problems.length} parsed).`)
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err)
  process.exit(1)
})


