import { Injectable } from '@nestjs/common'
import pdf from 'pdf-parse'
import { ResumesAiService } from './resumes.ai.service'
import * as fs from 'fs'

type ResumeSection = { id: string; type: string; title: string; order: number; content: unknown }

type EducationItem = { school: string; degree?: string; field?: string; startDate?: string; endDate?: string; gpa?: string }

type ExperienceItem = { company?: string; role?: string; startDate?: string; endDate?: string; bullets: string[] }

type ResumeSeed = {
  personal_info: { fullName?: string; email?: string; phone?: string; location?: string }
  sections: Array<ResumeSection>
  summary?: string | null
  education?: Array<EducationItem>
  technologies?: Array<{ name: string; skills: string[] }>
  additional_section?: Array<ResumeSection>
}

@Injectable()
export class ResumesParseService {
  constructor(private readonly ai: ResumesAiService) {}
  async parsePdf(file?: { buffer?: Buffer; path?: string; originalname?: string }): Promise<ResumeSeed> {
    const t0 = Date.now()
    if (!file) {
      return this.empty('No file received')
    }

    let buffer: Buffer | null = null
    try {
      if (file.buffer && Buffer.isBuffer(file.buffer)) {
        buffer = file.buffer as Buffer
      } else if (file.path && typeof file.path === 'string' && fs.existsSync(file.path)) {
        buffer = await fs.promises.readFile(file.path)
      }
    } catch {
      // ignore; will fallback to empty
    }

    if (!buffer) {
      return this.empty('Unsupported upload source')
    }

    try {
      // Prefer AI direct file parsing when available
      const aiMapped = await this.ai.parseResumeFromFile({ buffer, filename: (file && typeof file.originalname === 'string') ? file.originalname : 'resume.pdf' })
      // Heuristic: if AI returns only boilerplate (no experience items and minimal personal info), fall back to text extraction
      const aiSections: Array<ResumeSection> = Array.isArray((aiMapped as any)?.sections) ? (aiMapped as any).sections : []
      const exp = aiSections.find((s: any) => s?.type === 'experience') as any
      const expItems = Array.isArray(exp?.content) ? exp.content : []
      const pi = (aiMapped as any)?.personal_info || {}
      const piUseful = Boolean((pi?.fullName && String(pi.fullName).trim()) || (pi?.email && String(pi.email).trim()))
      if (expItems.length > 0 || piUseful) {
        // Augment AI results with Achievements/Leadership if missing by doing a lightweight text pass
        let needsAugment = true
        try {
          const hasAchievements = aiSections.some((s: any) => s?.type === 'achievements' && Array.isArray((s as any).content) && (s as any).content.length)
          const hasLeadership = aiSections.some((s: any) => s?.type === 'leadership' && Array.isArray((s as any).content) && (s as any).content.length)
          if (!hasAchievements || !hasLeadership) {
            const result = await pdf(buffer)
            const rawText = String(result.text || '')
            const text = this.normalizeWhitespace(rawText)
            const lines = text.split(/\n+/).map((l) => l.trim()).filter(Boolean)
            const sectionsMap = this.segmentByHeadings(lines)
            const ach = hasAchievements ? [] : this.extractAchievements(sectionsMap)
            const lead = hasLeadership ? [] : this.extractLeadership(sectionsMap)
            if (ach.length) aiSections.push({ id: 'achievements', type: 'achievements', title: 'Achievements', order: aiSections.length, content: ach })
            if (lead.length) aiSections.push({ id: 'leadership', type: 'leadership', title: 'Leadership', order: aiSections.length, content: lead })
            ;(aiMapped as any).sections = aiSections
          }
          needsAugment = false
        } catch {
          // ignore augment failures
        }
        return aiMapped as unknown as ResumeSeed
      }
      // else fall through to text extraction
    } catch {
      console.warn('[ResumeParse] AI file parse failed, falling back to text extraction')
    }

    // Fallback: non-AI text extraction and heuristics
    try {
      console.log('[ResumeParse] falling back to pdf-parse text extraction')
      const result = await pdf(buffer)
      const rawText = String(result.text || '')
      const text = this.normalizeWhitespace(rawText)

      const lines = text.split(/\n+/).map((l) => l.trim()).filter(Boolean)

      const personal = this.extractPersonalInfo(lines)
      const sectionsMap = this.segmentByHeadings(lines)
      const summaryText = this.extractSummary(sectionsMap)
      const skills = this.extractSkills(sectionsMap)
      const education = this.extractEducation(sectionsMap)
      const experience = this.extractExperience(sectionsMap)
      const achievements = this.extractAchievements(sectionsMap)
      const leadership = this.extractLeadership(sectionsMap)

      const sections: Array<ResumeSection> = this.composeSections(summaryText || '', experience, education, skills, achievements, leadership)
      console.log('[ResumeParse] extracted summary_len=%d exp=%d edu=%d skills=%d ach=%d lead=%d', (summaryText || '').length, experience.length, education.length, skills.length, achievements.length, leadership.length)
      return {
        personal_info: personal,
        sections,
        summary: summaryText,
        education,
        technologies: skills.length ? [{ name: '', skills }] : [],
        additional_section: [],
      }
    } catch {
      return this.empty('PDF parse failed')
    }
  }

  private composeSections(summaryText: string, experience: Array<ExperienceItem>, education: Array<EducationItem>, skills: string[], achievements: Array<{ title?: string; description?: string; date?: string }>, leadership: Array<{ title?: string; description?: string; date?: string }>): Array<ResumeSection> {
    const sections: Array<ResumeSection> = []
    sections.push({ id: 'summary', type: 'summary', title: 'Professional Summary', order: 0, content: { text: summaryText || '' } })
    if (experience.length) {
      sections.push({ id: 'experience', type: 'experience', title: 'Experience', order: sections.length, content: experience })
    }
    if (education.length) {
      sections.push({ id: 'education', type: 'education', title: 'Education', order: sections.length, content: education })
    }
    if (skills.length) {
      sections.push({ id: 'skills', type: 'skills', title: 'Skills', order: sections.length, content: { groups: [{ name: '', skills }] } })
    }
    if (achievements.length) {
      sections.push({ id: 'achievements', type: 'achievements', title: 'Achievements', order: sections.length, content: achievements })
    }
    if (leadership.length) {
      sections.push({ id: 'leadership', type: 'leadership', title: 'Leadership', order: sections.length, content: leadership })
    }
    if (sections.length === 1) {
      sections.push({ id: 'experience', type: 'experience', title: 'Experience', order: 1, content: [] })
    }
    return sections
  }

  private empty(_note?: string): ResumeSeed {
    return {
      personal_info: {},
      sections: [
        { id: 'summary', type: 'summary', title: 'Professional Summary', order: 0, content: { text: '' } },
        { id: 'experience', type: 'experience', title: 'Experience', order: 1, content: [] },
      ],
      summary: '',
      education: [],
      technologies: [],
    }
  }

  private normalizeWhitespace(s: string): string {
    return (s || '')
      .replace(/\r/g, '')
      .replace(/[\t\f\v]+/g, ' ')
      .replace(/\u00A0/g, ' ')
      .replace(/\s+\n/g, '\n')
      .replace(/\n\s+/g, '\n')
      .trim()
  }

  private extractPersonalInfo(lines: string[]): { fullName?: string; email?: string; phone?: string; location?: string } {
    const emailMatch = lines.join(' ').match(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/)
    const phoneMatch = lines.join(' ').match(/\+?\d[\d\s().-]{8,}/)
    // Heuristic: first non-empty line that is not a heading
    let fullName: string | undefined
    for (const l of lines.slice(0, 6)) {
      const t = l.replace(/[•*\d.,/|-]+/g, '').trim()
      if (!t) continue
      if (/^(resume|curriculum vitae|cv)$/i.test(t)) continue
      if (this.looksLikeHeading(t)) continue
      if (t.split(' ').length <= 8 && /[A-Za-z]/.test(t)) {
        fullName = t
        break
      }
    }
    // Location heuristic: line containing city/state separators or commas, near top
    let location: string | undefined
    for (const l of lines.slice(0, 12)) {
      if (/\b([A-Z][a-z]+\s?[,|-]\s?[A-Z]{2,}|[A-Z][a-z]+,\s?[A-Z][a-z]+)/.test(l)) {
        location = l.trim()
        break
      }
    }
    return {
      fullName,
      email: emailMatch ? emailMatch[0] : undefined,
      phone: phoneMatch ? phoneMatch[0] : undefined,
      location,
    }
  }

  private looksLikeHeading(s: string): boolean {
    const t = s.trim()
    return /^(experience|work experience|professional experience|education|skills|technical skills|summary|profile|objective|projects|achievements|certifications|awards|honors|leadership|positions of responsibility|volunteer|volunteering)\b/i.test(t)
  }

  private segmentByHeadings(lines: string[]): Record<string, string[]> {
    const map: Record<string, string[]> = {}
    let current = 'top'
    map[current] = []
    for (const raw of lines) {
      const l = raw.trim()
      if (this.looksLikeHeading(l)) {
        const key = l.toLowerCase().replace(/\s+/g, ' ').split(':')[0]
        current = key
        if (!map[current]) map[current] = []
      } else {
        if (!map[current]) map[current] = []
        map[current].push(l)
      }
    }
    return map
  }

  private extractSummary(sections: Record<string, string[]>): string {
    const candidates = ['summary', 'profile', 'objective']
    for (const k of candidates) {
      const arr = sections[k]
      if (Array.isArray(arr) && arr.length) {
        return arr.join(' ').slice(0, 600)
      }
    }
    const top = sections['top'] || []
    return top.slice(0, 4).join(' ')
  }

  private extractSkills(sections: Record<string, string[]>): string[] {
    const skillsSec = sections['skills'] || sections['technical skills'] || []
    const all = skillsSec.join('\n')
    const tokens = all
      .split(/\n|,|\u2022|•|-|·/)
      .map((s) => s.trim())
      .filter((s) => s.length > 1 && /[A-Za-z]/.test(s))
    const uniq = Array.from(new Set(tokens.map((t) => t.replace(/\s{2,}/g, ' '))))
    return uniq.slice(0, 30)
  }

  private extractEducation(sections: Record<string, string[]>): Array<EducationItem> {
    const edu = sections['education'] || []
    if (!edu.length) return []
    const items: Array<EducationItem> = []
    let buffer: string[] = []
    const pushBuffer = () => {
      if (!buffer.length) return
      const block = buffer.join(' | ')
      const schoolMatch = block.match(/([A-Z][A-Za-z.&-\s]+(?:University|Institute|College|School|Academy))/)
      const degreeMatch = block.match(/(Bachelor|Master|B\.?Sc\.?|M\.?Sc\.?|B\.?Tech\.?|M\.?Tech\.?|Ph\.?D\.?|MBA)[^|]*/i)
      const fieldMatch = block.match(/in\s+([A-Za-z/&-\s]{3,})/i)
      const datesMatch = block.match(/(\b\w{3,}\.?\s?\d{4}|\d{4})\s?-\s?(Present|\b\w{3,}\.?\s?\d{4}|\d{4})/i)
      const gpaMatch = block.match(/GPA\s*[:-]?\s*([0-9]\.?[0-9]{0,2})/i)
      const item: EducationItem = {
        school: schoolMatch ? schoolMatch[1].trim() : block.split('|')[0].trim(),
        degree: degreeMatch ? degreeMatch[0].trim() : undefined,
        field: fieldMatch ? fieldMatch[1].trim() : undefined,
        startDate: datesMatch ? datesMatch[1] : undefined,
        endDate: datesMatch ? datesMatch[2] : undefined,
        gpa: gpaMatch ? gpaMatch[1] : undefined,
      }
      items.push(item)
      buffer = []
    }
    for (const l of edu) {
      if (!l) continue
      if (/^\s*$/.test(l) || /^\W+$/.test(l)) {
        pushBuffer()
        continue
      }
      buffer.push(l)
    }
    pushBuffer()
    return items.slice(0, 3)
  }

  private extractExperience(sections: Record<string, string[]>): Array<ExperienceItem> {
    const exp = sections['experience'] || sections['work experience'] || sections['professional experience'] || []
    if (!exp.length) return []
    const items: Array<ExperienceItem> = []
    let block: string[] = []
    const pushBlock = () => {
      if (!block.length) return
      const header = block[0] || ''
      const rest = block.slice(1)
      const bullets = rest
        .filter((l) => /^[•*\u2022-]/.test(l) || l.length > 20)
        .map((l) => l.replace(/^[•*\u2022-]\s*/, '').trim())
        .filter(Boolean)
      const atSplit = header.split(/\s+at\s+/i)
      let role: string | undefined
      let company: string | undefined
      if (atSplit.length === 2) {
        role = atSplit[0].trim()
        company = atSplit[1].trim()
      } else if (/-/.test(header)) {
        const parts = header.split(/\s+-\s+/)
        role = (parts[0] || '').trim()
        company = (parts[1] || '').trim()
      } else {
        // Try to infer company keywords
        if (/\b(Inc\.|LLC|Ltd\.|Corporation|Company|Labs|Technologies|Systems)\b/i.test(header)) {
          company = header.trim()
        } else {
          role = header.trim()
        }
      }
      items.push({ company, role, startDate: undefined, endDate: undefined, bullets: bullets.slice(0, 6) })
      block = []
    }
    for (const l of exp) {
      if (!l) continue
      if (/^\s*$/.test(l)) {
        pushBlock()
        continue
      }
      if (this.looksLikeHeading(l)) {
        pushBlock()
        continue
      }
      // New role delimiter heuristic: lines with title-casing and year or date ranges
      if (/(\b\d{4}\b|Present)/.test(l) && block.length > 0) {
        pushBlock()
      }
      block.push(l)
    }
    pushBlock()
    // Filter empty blocks
    return items.filter((it) => (it.company || it.role || (it.bullets && it.bullets.length))).slice(0, 6)
  }

  private extractAchievements(sections: Record<string, string[]>): Array<{ title?: string; description?: string; date?: string }> {
    const src = sections['achievements'] || sections['awards'] || sections['honors'] || []
    if (!src.length) return []
    const items: Array<{ title?: string; description?: string; date?: string }> = []
    for (const line of src) {
      const l = String(line).replace(/^[-•\u2022]\s*/, '').trim()
      if (!l) continue
      const dateMatch = l.match(/(\b\d{4}\b|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[^,]*$/i)
      const date = dateMatch ? dateMatch[0] : undefined
      const title = date ? l.replace(date, '').replace(/[–—-]\s*$/, '').trim() : l
      items.push({ title, date })
    }
    return items.slice(0, 10)
  }

  private extractLeadership(sections: Record<string, string[]>): Array<{ title?: string; description?: string; date?: string }> {
    const src = sections['leadership'] || sections['positions of responsibility'] || sections['volunteer'] || sections['volunteering'] || []
    if (!src.length) return []
    const items: Array<{ title?: string; description?: string; date?: string }> = []
    let buffer: string[] = []
    const push = () => {
      if (!buffer.length) return
      const block = buffer.join(' ')
      const dateMatch = block.match(/(\b\d{4}\b|Present|\b\w{3,}\.?,?\s?\d{4})/)
      const date = dateMatch ? dateMatch[0] : undefined
      items.push({ title: block.replace(String(date || ''), '').trim(), date })
      buffer = []
    }
    for (const l of src) {
      if (/^[-•\u2022]/.test(l) && buffer.length) push()
      if (!/^[\s\W]*$/.test(l)) buffer.push(l.replace(/^[-•\u2022]\s*/, ''))
    }
    push()
    return items.slice(0, 10)
  }
}


