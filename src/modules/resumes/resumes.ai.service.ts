import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import OpenAI from 'openai'
import { jsonrepair } from 'jsonrepair'
import { TavilyProvider, TavilySearchResult } from '../../lib/ai/tavily-provider'

@Injectable()
export class ResumesAiService {
  private client: OpenAI | null = null
  private tavily: TavilyProvider | null = null

  constructor(private readonly config: ConfigService) {
    const key = this.config.get<string>('OPENROUTER_API_KEY') || this.config.get<string>('OPENAI_API_KEY')
    if (key) {
      this.client = new OpenAI({
        apiKey: key,
        baseURL: this.config.get<string>('OPENROUTER_BASE_URL') || 'https://openrouter.ai/api/v1',
        defaultHeaders: {
          'HTTP-Referer': 'https://cognipin.com',
          'X-Title': 'Huntier Resume AI',
        },
      })
    }
    const tavilyKey = this.config.get<string>('TAVILY_API_KEY') || ''
    if (tavilyKey) {
      this.tavily = new TavilyProvider(tavilyKey)
    }
  }

  /**
   * Import profile and experience from LinkedIn public profile HTML or URL.
   * - If url is provided, the caller/controller should have fetched HTML; here we accept either.
   * - The LLM is prompted to return strict JSON with sections mapped to our schema.
   */
  async importFromLinkedIn(input: { html?: string; url?: string }): Promise<{
    personal_info: any;
    sections: any[];
    summary?: string | null;
    education?: any[];
    technologies?: any[];
    note?: string;
  }> {
    const empty = { personal_info: {}, sections: [], summary: null, education: [], technologies: [], note: 'AI disabled or no input' }

    if (!this.client) return empty
    // Build evidence set from Tavily (scoped to LinkedIn) and/or provided HTML
    const excerpts: Array<{ url: string; title: string; content: string }> = []
    try {
      if (this.tavily && input?.url) {
        const query = input.url.includes('linkedin.com') ? input.url : `site:linkedin.com/in ${input.url}`
        const t = await this.tavily.search(query, { maxResults: 6, searchDepth: 'advanced' })
        const topLinkedIn = (t.results || [])
          .filter((r: TavilySearchResult) => (r.domain || '').includes('linkedin.com'))
          .filter((r: TavilySearchResult) => /linkedin\.com\/in\//.test(r.url))
          .sort((a, b) => (b.score || 0) - (a.score || 0))
          .slice(0, 3)
        topLinkedIn.forEach((r) => {
          if (r.content && r.content.trim()) {
            excerpts.push({ url: r.url, title: r.title || 'LinkedIn', content: r.content.slice(0, 8000) })
          }
        })
      }
    } catch {
      // Ignore LinkedIn API errors
    }

    if (input?.html && input.html.trim()) {
      const htmlSnippet = input.html.slice(0, 8000)
      excerpts.push({ url: input.url || 'provided://html', title: 'Provided HTML', content: htmlSnippet })
    }

    if (excerpts.length === 0) {
      return { ...empty, note: 'No evidence found from LinkedIn. Provide linkedin_url or html.' }
    }

    const messages = [
      { role: 'system' as const, content: [
        'You are a faithful information extractor.',
        'You will receive multiple text excerpts from a LinkedIn profile. Extract ONLY facts explicitly present in the excerpts. If a field is not present, omit it.',
        'Output STRICT JSON with keys: personal_info, sections, summary, education, technologies.',
        'personal_info: { fullName?, email?, phone?, location? } — include only if present.',
        'sections: include an experience block when roles are found as: { id, type:"experience", title:"Experience", order, content: [ { company, role, startDate?, endDate?, bullets: string[] } ] }.',
        // Use the client-side education shape to match UI directly
        'education: array of { school, degree?, field?, startDate?, endDate?, gpa? } present in excerpts.',
        'technologies: array of groups: { name, skills: string[] } when skills are explicitly listed; otherwise omit.',
        'summary: 1-3 sentence summary ONLY if a summary/about section is present in the excerpts.',
        'Do NOT infer or invent information. If unsure, omit. Return only valid JSON with no markdown fences.'
      ].join('\n') },
      { role: 'user' as const, content: JSON.stringify({ url: input.url || null, excerpts }) },
    ]

    try {
      const resp = await this.client.chat.completions.create({
        model: 'mistralai/mistral-small-3.2-24b-instruct:free',
        messages,
        temperature: 0,
        response_format: { type: 'json_object' } as any,
        max_tokens: 1800,
      })
      const raw = stripFences(resp.choices[0]?.message?.content || '')
      let data: any
      try {
        data = JSON.parse(raw)
      } catch {
        return { ...empty, note: 'Parsing failed' }
      }

      // Normalize education shape to { school, degree, field, startDate, endDate, gpa }
      const normalizedEducation: any[] = Array.isArray(data?.education) ? data.education.map((e: any) => ({
        school: e?.school || e?.institution || e?.college || e?.university || undefined,
        degree: e?.degree || undefined,
        field: e?.field || e?.major || undefined,
        startDate: e?.startDate || undefined,
        endDate: e?.endDate || (e?.graduationYear ? String(e.graduationYear) : undefined),
        gpa: e?.gpa || undefined,
      })) : []

      const safe = {
        personal_info: data?.personal_info || {},
        sections: Array.isArray(data?.sections) ? data.sections : [],
        summary: data?.summary ?? null,
        education: normalizedEducation,
        technologies: Array.isArray(data?.technologies) ? data.technologies : [],
        note: undefined as string | undefined,
      }

      // Fallbacks: add sample skills/education when missing
      if (!Array.isArray(safe.technologies) || safe.technologies.length === 0) {
        safe.technologies = [{ name: '', skills: sampleSkills(9) }]
      }
      if (!Array.isArray(safe.education) || safe.education.length === 0) {
        safe.education = [sampleEducation()]
      }

      // Ensure sections includes a summary section as first element
      const summaryText = typeof safe.summary === 'string' ? safe.summary : ''
      const sections = Array.isArray(safe.sections) ? [...safe.sections] : []
      const withoutSummary = sections.filter((s) => s?.type !== 'summary')
      const ordered = withoutSummary.sort((a, b) => (a?.order ?? 0) - (b?.order ?? 0))
      const withSummary = [
        { id: 'summary', type: 'summary', title: 'Professional Summary', order: 0, content: { text: summaryText } },
        ...ordered.map((s, i) => ({ ...s, order: i + 1 })),
      ]

      console.log('safe', { ...safe, sections: withSummary })
      return { ...safe, sections: withSummary }
    } catch {
      return empty
    }
  }

  async suggestSummary(context: { personal_info?: any; sections?: any[]; job?: string }): Promise<{ summary: string }> {
    const fallback = 'Experienced professional with a proven track record of delivering impact across projects.'
    if (!this.client) return { summary: fallback }

    const messages = [
      { role: 'system' as const, content: 'You draft concise, ATS-friendly resume summaries (2-3 sentences, active voice).' },
      { role: 'user' as const, content: JSON.stringify(context) },
    ]
    try {
      const resp = await this.client.chat.completions.create({
        model: 'moonshotai/kimi-k2:free',
        messages,
        temperature: 0.4,
        max_tokens: 220,
      })
      const text = resp.choices[0]?.message?.content?.trim() || fallback
      return { summary: stripFences(text) }
    } catch {
      return { summary: fallback }
    }
  }

  async suggestBullets(context: { role?: string; jd?: string; experience?: any }): Promise<{ bullets: string[] }> {
    const fallback = ['Delivered measurable outcomes with cross-functional teams.', 'Improved key metrics through data-driven decisions.']
    if (!this.client) return { bullets: fallback }
    const messages = [
      { role: 'system' as const, content: 'You write quantified resume bullets using action-result-metric structure.' },
      { role: 'user' as const, content: JSON.stringify(context) },
    ]
    try {
      const resp = await this.client.chat.completions.create({
        model: 'moonshotai/kimi-k2:free',
        messages,
        temperature: 0.4,
        max_tokens: 220,
      })
      const text = stripFences(resp.choices[0]?.message?.content || '')
      const bullets = text
        .split(/\n|\r/)
        .map((s) => s.replace(/^[-•]\s*/, '').trim())
        .filter(Boolean)
        .slice(0, 8)
      return { bullets: bullets.length ? bullets : fallback }
    } catch {
      return { bullets: fallback }
    }
  }

  async extractKeywords(context: { jd: string; resume?: any }): Promise<{ keywords: string[]; score: number }> {
    const base = { keywords: [] as string[], score: 0 }
    if (!this.client) return base
    const messages = [
      { role: 'system' as const, content: 'Extract 10-20 role-relevant keywords for ATS matching; return only comma-separated list.' },
      { role: 'user' as const, content: JSON.stringify(context) },
    ]
    try {
      const resp = await this.client.chat.completions.create({
        model: 'moonshotai/kimi-k2:free',
        messages,
        temperature: 0.2,
        max_tokens: 200,
      })
      const raw = stripFences(resp.choices[0]?.message?.content || '')
      const keywords = raw.split(/,|\n/).map((s) => s.trim()).filter(Boolean).slice(0, 20)
      // naive score until better scoring
      return { keywords, score: Math.min(100, keywords.length * 5) }
    } catch {
      return base
    }
  }

  /**
   * Parse resume text (extracted from a PDF) into our draft resume schema using an LLM.
   * Returns a safe object with sections normalized to include summary, education, and skills.
   */
  async parseResumeFromText(input: { text: string }): Promise<{
    personal_info: any
    sections: any[]
    summary?: string | null
    education?: any[]
    technologies?: any[]
  }> {
    const base = {
      personal_info: { fullName: 'John Doe', email: 'john.doe@example.com', phone: '—', location: '—' },
      sections: [] as any[],
      summary: 'Experienced professional delivering measurable impact across projects and teams.',
      education: [sampleEducation()],
      technologies: [{ name: '', skills: sampleSkills(9) }],
    }

    if (!this.client) {
      return ensureSectionSet(base)
    }

    const trimmed = (input?.text || '').slice(0, 18000)
    if (!trimmed.trim()) {
      return ensureSectionSet(base)
    }

    const messages = [
      { role: 'system' as const, content: [
        'You are a precise information extractor for resumes. Input is raw text extracted from a PDF.',
        'Output STRICT JSON with keys: personal_info, sections, summary, education, technologies.',
        'personal_info: { fullName?, email?, phone?, location? } — use exact values from text when present.',
        'sections: include an experience block when roles/companies are found: { id, type:"experience", title:"Experience", order, content: [ { company, role, startDate?, endDate?, bullets: string[] } ] }.',
        'education: array of { school, degree?, field?, startDate?, endDate?, gpa? } present in text.',
        'technologies: array of groups: { name, skills: string[] }. If skills are listed, include them as a single group.',
        'summary: 1-3 sentence professional summary if present; otherwise omit (will be added later).',
        'Do NOT invent facts. If unsure, omit. Return only valid JSON with no markdown fences.'
      ].join('\n') },
      { role: 'user' as const, content: JSON.stringify({ text: trimmed }) },
    ]

    try {
      const resp = await this.client.chat.completions.create({
        model: 'mistralai/mistral-small-3.2-24b-instruct:free',
        messages,
        temperature: 0,
        response_format: { type: 'json_object' } as any,
        max_tokens: 1800,
      })
      const raw = stripFences(resp.choices[0]?.message?.content || '')
      const data = JSON.parse(raw)

      // Normalize education shape to { school, degree, field, startDate, endDate, gpa }
      const normalizedEducation: any[] = Array.isArray(data?.education) ? data.education.map((e: any) => ({
        school: e?.school || e?.institution || e?.college || e?.university || undefined,
        degree: e?.degree || undefined,
        field: e?.field || e?.major || undefined,
        startDate: e?.startDate || undefined,
        endDate: e?.endDate || (e?.graduationYear ? String(e.graduationYear) : undefined),
        gpa: e?.gpa || undefined,
      })) : []

      const safe = {
        personal_info: data?.personal_info || {},
        sections: Array.isArray(data?.sections) ? data.sections : [],
        summary: typeof data?.summary === 'string' ? data.summary : null,
        education: normalizedEducation,
        technologies: Array.isArray(data?.technologies) ? data.technologies : [],
      }

      // Fallbacks
      if (!Array.isArray(safe.technologies) || safe.technologies.length === 0) {
        safe.technologies = [{ name: '', skills: sampleSkills(9) }]
      }
      if (!Array.isArray(safe.education) || safe.education.length === 0) {
        safe.education = [sampleEducation()]
      }

      // Ensure essential sections and ordering
      const withEssentials = ensureSectionSet(safe)
      return withEssentials
    } catch {
      return ensureSectionSet(base)
    }
  }

  /**
   * Parse resume directly from a PDF buffer using the model's file understanding capabilities.
   * Falls back to a safe scaffold when unavailable.
   */
  async parseResumeFromFile(input: { buffer: Buffer; filename?: string }): Promise<{
    personal_info: any
    sections: any[]
    summary?: string | null
    education?: any[]
    technologies?: any[]
  }> {
    const base = {
      personal_info: {
        fullName: 'John Doe',
        email: 'john.doe@example.com',
        phone: '—',
        location: '—',
      },
      sections: [] as any[],
      summary: 'Experienced professional delivering measurable impact across projects and teams.',
      education: [sampleEducation()],
      technologies: [{ name: '', skills: sampleSkills(9) }],
    }
    if (!this.client) return ensureSectionSet(base)

    try {
      // Use OpenRouter chat.completions with base64-encoded PDF per docs
      const filename = input.filename || 'resume.pdf'
      const dataUrl = `data:application/pdf;base64,${input.buffer.toString('base64')}`

      const prompt = [
        'You are a precise information extractor for resumes. Input is a PDF file.',
        'Output STRICT JSON with keys: personal_info, sections, summary, education, technologies.',
        'personal_info: { fullName?, email?, phone?, location? } — use exact values from the file when present.',
        'sections: include an experience block when roles/companies are found: { id, type:"experience", title:"Experience", order, content: [ { company, role, startDate?, endDate?, bullets: string[] } ] }.',
        'education: array of { school, degree?, field?, startDate?, endDate?, gpa? } present in the file.',
        'technologies: array of groups: { name, skills: string[] }. If skills are listed, include them as a single group.',
        'summary: 1-3 sentence professional summary if present; otherwise omit (will be added later).',
        'Do NOT invent facts. If unsure, omit. Return only valid JSON with no markdown fences.'
      ].join('\n')

      const resp = await this.client.chat.completions.create({
        model: 'mistralai/mistral-small-3.2-24b-instruct:free',
        messages: [
          {
            role: 'system',
            content: [{ type: 'text', text: prompt }] as any,
          },
          {
            role: 'user',
            content: [
              { type: 'text', text: 'Parse this resume and return strict JSON as specified.' },
              { type: 'file', file: { filename, file_data: dataUrl } },
            ] as any,
          },
        ],
        // Prefer text engine to avoid OCR cost unless needed
        plugins: [
          { id: 'file-parser', pdf: { engine: 'pdf-text' } },
        ],
        temperature: 0,
        response_format: { type: 'json_object' } as any,
        max_tokens: 1800,
      } as any)

      const raw = stripFences(resp.choices?.[0]?.message?.content || '')
      const data = safeParseJson(raw)

      // Normalize education
      const normalizedEducation: any[] = Array.isArray(data?.education) ? data.education.map((e: any) => ({
        school: e?.school || e?.institution || e?.college || e?.university || undefined,
        degree: e?.degree || undefined,
        field: e?.field || e?.major || undefined,
        startDate: e?.startDate || undefined,
        endDate: e?.endDate || (e?.graduationYear ? String(e.graduationYear) : undefined),
        gpa: e?.gpa || undefined,
      })) : []

      const safe = {
        personal_info: data?.personal_info || {},
        sections: Array.isArray(data?.sections) ? data.sections : [],
        summary: typeof data?.summary === 'string' ? data.summary : null,
        education: normalizedEducation,
        technologies: Array.isArray(data?.technologies) ? data.technologies : [],
      }

      // Fallback defaults
      if (!Array.isArray(safe.technologies) || safe.technologies.length === 0) {
        safe.technologies = [{ name: '', skills: sampleSkills(9) }]
      }
      if (!Array.isArray(safe.education) || safe.education.length === 0) {
        safe.education = [sampleEducation()]
      }

      const withEssentials = ensureSectionSet(safe)
      return withEssentials
    } catch (e) {
      console.log('[ResumeParse] AI file parse failed, falling back to text extraction', e)
      return ensureSectionSet(base)
    }
  }

  /**
   * Generate a default resume scaffold strictly following the resume schema
   * using available user profile information. This is used to prefill a new
   * resume with sensible placeholders before the user edits.
   */
  async generateDefaultFromProfile(profile: any): Promise<{
    personal_info: any
    sections: any[]
    summary?: string | null
    education?: any[]
    technologies?: any[]
  }> {
    const base = {
      personal_info: {
        fullName: (profile?.user?.full_name || profile?.full_name || '').trim() || 'John Doe',
        email: (profile?.user?.email || profile?.email || '').trim() || 'john.doe@example.com',
        phone: '—',
        location: profile?.persona_info?.location || profile?.location || '—',
      },
      sections: [] as any[],
      summary: 'Experienced professional delivering measurable impact across projects and teams.',
      education: [sampleEducation()],
      technologies: [{ name: '', skills: sampleSkills(9) }],
    }

    // Seed one experience item (conjure if missing)
    const seedRole = (profile?.current_role || '').trim()
    const seedCompany = (profile?.company?.name || profile?.current_company || '').trim()
    const conjuredRole = seedRole || 'Software Engineer'
    const conjuredCompany = seedCompany || 'Acme Corp'
    base.sections.push({
      id: 'experience',
      type: 'experience',
      title: 'Experience',
      order: 0,
      content: [
        {
          company: conjuredCompany,
          role: conjuredRole,
          startDate: '',
          endDate: 'Present',
          bullets: sampleBullets(conjuredRole),
        },
      ],
    })

    if (!this.client) {
      // Ensure sections include summary, education and skills
      const withEssentials = ensureSectionSet(base)
      return withEssentials
    }

    // Ask the model to produce a complete object in our schema using profile hints
    const messages = [
      { role: 'system' as const, content: [
        'You generate a starter resume strictly in the provided JSON schema.',
        'Schema keys: personal_info, sections, summary, education, technologies.',
        'Return valid JSON only (no markdown fences).',
        'Rules:',
        '- Use provided profile details verbatim where available (role, company, persona).',
        '- Create 3-5 quantified bullets for the first experience if role/company are present.',
        '- If dates are unknown, leave empty or use "Present" for current roles.',
        '- Add a concise 2-3 sentence professional summary tailored to the role.',
        '- Provide a skills grouping under technologies with 6-12 relevant skills.',
      ].join('\n') },
      { role: 'user' as const, content: JSON.stringify({ profile, seed: base }) },
    ]

    try {
      const resp = await this.client.chat.completions.create({
        model: 'mistralai/mistral-small-3.2-24b-instruct:free',
        messages,
        temperature: 0.3,
        response_format: { type: 'json_object' } as any,
        max_tokens: 1600,
      })
      const raw = stripFences(resp.choices[0]?.message?.content || '')
      const data = JSON.parse(raw)
      const safe = {
        personal_info: normalizePersonalInfo(data?.personal_info, base.personal_info),
        sections: Array.isArray(data?.sections) ? data.sections : base.sections,
        summary: stringOr(data?.summary, base.summary),
        education: Array.isArray(data?.education) && data.education.length ? data.education : base.education,
        technologies: Array.isArray(data?.technologies) && data.technologies.length ? data.technologies : base.technologies,
      }

      // Ensure experience has at least one item with bullets
      const expIdx = (safe.sections || []).findIndex((s: any) => s?.type === 'experience')
      if (expIdx === -1) {
        safe.sections = [
          ...safe.sections,
          {
            id: 'experience',
            type: 'experience',
            title: 'Experience',
            order: 1,
            content: base.sections.find((s: any) => s.type === 'experience')?.content || base.sections[0].content,
          },
        ]
      } else {
        const exp = safe.sections[expIdx]
        const items = Array.isArray(exp?.content) ? exp.content : []
        if (items.length === 0) {
          safe.sections[expIdx] = { ...exp, content: base.sections[0].content }
        } else {
          safe.sections[expIdx] = {
            ...exp,
            content: items.map((it: any) => ({
              company: stringOr(it?.company, conjuredCompany),
              role: stringOr(it?.role, conjuredRole),
              startDate: stringOr(it?.startDate, ''),
              endDate: stringOr(it?.endDate, 'Present'),
              bullets: Array.isArray(it?.bullets) && it.bullets.length ? it.bullets : sampleBullets(stringOr(it?.role, conjuredRole)),
            })),
          }
        }
      }

      // Ensure sections include summary, education, and skills (with groups)
      const withEssentials = ensureSectionSet(safe)

      return withEssentials
    } catch {
      return ensureSectionSet(base)
    }
  }
}

function stripFences(s: string): string {
  let t = (s || '').trim()
  if (t.startsWith('```')) t = t.replace(/^```[a-z]*\n?/i, '').replace(/\n?```$/, '')
  return t.trim()
}

function safeParseJson(s: string): any {
  try {
    return JSON.parse(s)
  } catch {
    try {
      const repaired = jsonrepair(s)
      return JSON.parse(repaired)
    } catch {
      return {}
    }
  }
}

function sampleSkills(n = 8): string[] {
  const pool = [
    'TypeScript', 'React', 'Node.js', 'GraphQL', 'PostgreSQL', 'Redis', 'AWS', 'Docker', 'Kubernetes', 'CI/CD',
    'Jest', 'Cypress', 'TailwindCSS', 'Next.js', 'Python', 'Go', 'Microservices', 'System Design'
  ]
  const shuffled = [...pool].sort(() => Math.random() - 0.5)
  return shuffled.slice(0, Math.max(3, Math.min(n, pool.length)))
}

function sampleEducation() {
  return {
    school: 'Stanford University',
    degree: 'Bachelor of Science',
    field: 'Computer Science',
    startDate: 'Sep 2018',
    endDate: 'May 2022',
    gpa: undefined,
  }
}

function sampleBullets(role: string): string[] {
  const r = role || 'Software Engineer'
  return [
    `Led end-to-end delivery of critical ${r.toLowerCase()} project improving key KPI by 20%`,
    'Optimized system performance and reliability through observability and iterative tuning',
    'Collaborated cross-functionally to ship features on time with high quality',
  ]
}

function normalizePersonalInfo(pi: any, fallback: any) {
  const fullName = stringOr(pi?.fullName, fallback.fullName || 'John Doe')
  const email = stringOr(pi?.email, fallback.email || 'john.doe@example.com')
  const phone = stringOr(pi?.phone, fallback.phone || '—')
  const location = stringOr(pi?.location, fallback.location || '—')
  return { fullName, email, phone, location }
}

function stringOr(v: any, dflt: string): string {
  return typeof v === 'string' && v.trim() ? v.trim() : dflt
}

function ensureSectionSet(input: { personal_info: any; sections: any[]; summary: string | null; education: any[]; technologies: any[] }) {
  const summaryText = typeof input.summary === 'string' && input.summary.trim().length > 0
    ? input.summary.trim()
    : 'Experienced professional delivering measurable impact across projects and teams.'

  // Normalize experience section
  const existing = Array.isArray(input.sections) ? [...input.sections] : []
  const withoutSummary = existing.filter((s: any) => s?.type !== 'summary')
  const byType = new Map(withoutSummary.map((s: any) => [s?.type, s]))
  const experience = Array.isArray(byType.get('experience')?.content) ? byType.get('experience').content : input.sections.find((s: any) => s.type === 'experience')?.content || []
  const normalizedExperience = Array.isArray(experience) && experience.length ? experience.map((it: any) => ({
    company: stringOr(it?.company, 'Acme Corp'),
    role: stringOr(it?.role, 'Software Engineer'),
    startDate: stringOr(it?.startDate, ''),
    endDate: stringOr(it?.endDate, 'Present'),
    bullets: Array.isArray(it?.bullets) && it.bullets.length ? it.bullets : sampleBullets(stringOr(it?.role, 'Software Engineer')),
  })) : [
    { company: 'Acme Corp', role: 'Software Engineer', startDate: '', endDate: 'Present', bullets: sampleBullets('Software Engineer') },
  ]

  const edu = Array.isArray(input.education) && input.education.length ? input.education : [sampleEducation()]
  const tech = Array.isArray(input.technologies) && input.technologies.length ? input.technologies : [{ name: '', skills: sampleSkills(9) }]

  const ordered = [
    { id: 'summary', type: 'summary', title: 'Professional Summary', order: 0, content: { text: summaryText } },
    { id: 'experience', type: 'experience', title: 'Experience', order: 1, content: normalizedExperience },
    { id: 'education', type: 'education', title: 'Education', order: 2, content: edu },
    { id: 'skills', type: 'skills', title: 'Skills', order: 3, content: { groups: tech } },
  ]

  return {
    personal_info: normalizePersonalInfo(input.personal_info, input.personal_info || {}),
    sections: ordered,
    summary: summaryText,
    education: edu,
    technologies: tech,
  }
}


