import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import OpenAI from 'openai'
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
    } catch {}

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
        'education: array of { institution, degree?, field?, graduationYear?, gpa? } present in excerpts.',
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

      const safe = {
        personal_info: data?.personal_info || {},
        sections: Array.isArray(data?.sections) ? data.sections : [],
        summary: data?.summary ?? null,
        education: Array.isArray(data?.education) ? data.education : [],
        technologies: Array.isArray(data?.technologies) ? data.technologies : [],
        note: undefined as string | undefined,
      }
      console.log('safe', safe)
      return safe
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
}

function stripFences(s: string): string {
  let t = (s || '').trim()
  if (t.startsWith('```')) t = t.replace(/^```[a-z]*\n?/i, '').replace(/\n?```$/, '')
  return t.trim()
}


