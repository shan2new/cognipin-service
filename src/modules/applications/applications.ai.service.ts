import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import OpenAI from 'openai'

export type JDExtraction = {
  company_name?: string
  company_website_url?: string
  role?: string
  job_url?: string
  // Hosting platform (job board / ATS) inferred from the page URL or branding like Instahyre/LinkedIn/Lever/Greenhouse/Workday, not the employer
  platform_name?: string
  platform_url?: string
  contacts?: Array<{ name?: string; email?: string; phone?: string; title?: string; source?: string }>
  compensation?: {
    fixed_min_lpa?: number | null
    fixed_max_lpa?: number | null
    var_min_lpa?: number | null
    var_max_lpa?: number | null
    note?: string | null
  } | null
  notes?: string[]
  raw_text_excerpt?: string
}

@Injectable()
export class ApplicationsAiService {
  private client: OpenAI | null = null

  constructor(private readonly config: ConfigService) {
    const key = this.config.get<string>('OPENROUTER_API_KEY') || this.config.get<string>('OPENAI_API_KEY')
    if (key) {
      this.client = new OpenAI({
        apiKey: key,
        baseURL: this.config.get<string>('OPENROUTER_BASE_URL') || 'https://openrouter.ai/api/v1',
        defaultHeaders: {
          'HTTP-Referer': 'https://cognipin.com',
          'X-Title': 'Huntier Applications AI',
        },
      })
    }
  }

  /**
   * Extract job details from one or more JD images using a vision-capable model via OpenRouter.
   * Returns a strict JSON payload aligned with the application creation schema.
   */
  async extractFromJDImages(files: Array<{ buffer: Buffer; mimetype?: string }>): Promise<JDExtraction> {
    const fallback: JDExtraction = { notes: [], compensation: null }
    if (!this.client || !files?.length) return fallback

    // Build multimodal user content: text instruction + data URLs for images
    const userContent: any[] = [
      { type: 'text', text: [
        'You will receive one or more images of a single Job Description (JD).',
        'Extract ONLY facts present in the JD and return STRICT JSON matching the schema below.',
        'If a field is not present, output null or omit it. Convert all compensation to INR LPA when possible.',
        'Schema:',
        '{',
        '  company_name?: string,',
        '  company_website_url?: string,',
        '  role?: string,',
        '  job_url?: string,',
        '  platform_name?: string,',
        '  platform_url?: string,',
        '  contacts?: Array<{ name?: string; email?: string; phone?: string; title?: string; source?: string }>,',
        '  compensation?: { fixed_min_lpa?: number|null, fixed_max_lpa?: number|null, var_min_lpa?: number|null, var_max_lpa?: number|null, note?: string|null } | null,',
        '  notes?: string[],',
        '  raw_text_excerpt?: string',
        '}',
        'Rules:',
        '- role should be a clean, standardized title (e.g., "Senior Backend Engineer").',
        '- compensation: parse min/max ranges if possible; if only yearly CTC given, map to fixed_*; variable components to var_*.',
        '- company_website_url should be the employer’s official site if explicitly present.',
        '- job_url if the JD shows a link.',
        '- platform (platform_name/platform_url) is the HOSTING site (job board/ATS) like Instahyre/LinkedIn/Lever/Greenhouse/Workday; it is NOT the employer. Prefer the browser/page URL host if visible. If both employer and platform appear, set employer to company_* and platform_* to the hosting site.',
        '- contacts: if recruiter details (name, phone, email, company) are present in any image, extract one or more entries with best-effort fields.',
        '- notes: up to 3 short bullets with key requirements or highlights.',
        '- Return VALID JSON only with no markdown code fences.'
      ].join('\n') }
    ]

    for (const f of files) {
      const b64 = f.buffer?.toString('base64') || ''
      if (!b64) continue
      const dataUrl = `data:${f.mimetype || 'image/png'};base64,${b64}`
      userContent.push({ type: 'image_url', image_url: { url: dataUrl } })
    }

    try {
      const resp = await this.client.chat.completions.create({
        // Use a low-cost, vision-capable or general model; OpenRouter will route if supported
        model: 'google/gemma-3-4b-it',
        messages: [
          { role: 'system', content: 'You are a precise information extractor. Output strict JSON only.' },
          { role: 'user', content: userContent as any },
        ],
        temperature: 0,
        max_tokens: 4000,
      })

      const raw = (resp.choices?.[0]?.message?.content || '').trim()
      const json = this.strictJson<JDExtraction>(raw)
      return json || fallback
    } catch (err) {
      // Swallow errors and return a safe fallback so UX continues gracefully
      return fallback
    }
  }

  /**
   * Extract job details from an array of network entries (fetch/xhr request+response payloads)
   */
  async extractFromNetworkLogs(entries: Array<any>, screenshotDataUrl?: string): Promise<JDExtraction> {
    const fallback: JDExtraction = { notes: [], compensation: null }
    if (!this.client || !entries?.length) return fallback

    const trimmedEntries = entries.slice(0, 50)
    const sample = JSON.stringify(trimmedEntries).slice(0, 180000)
    try {
      const resp = await this.client.chat.completions.create({
        model: 'meta-llama/llama-3.2-3b-instruct',
        messages: [
          { role: 'system', content: 'You extract job application fields from JSON API payloads. Output strict JSON only.' },
          { role: 'user', content: [
            { type: 'text', text: [
              'You will receive a JSON array of network API entries captured from a job application page (ATS/board).',
              'Each entry can contain: url, method, status, request.{headers,body_preview}, response.{headers,body}.',
              'Return STRICT JSON with fields:',
              '{ company_name?, company_website_url?, role?, job_url?, platform_name?, platform_url?, contacts?, compensation?, notes?, raw_text_excerpt? }',
              'Rules:',
              '- Prefer response bodies from JSON API calls (GraphQL/REST) that clearly state job details.',
              '- If multiple entries conflict, choose the latest successful (2xx) response that looks most canonical.',
              '- role should be clean; company_website_url should be employer website when present.',
              '- platform_* refers to the hosting site (ATS/board), not the employer.',
              '- Capture key points in notes (<=3). Output VALID JSON only without markdown fences.'
            ].join('\n') },
            { type: 'text', text: sample },
            ...(screenshotDataUrl ? [{ type: 'image_url', image_url: { url: screenshotDataUrl } }] as any[] : [])
          ] as any },
        ],
        temperature: 0,
        max_tokens: 3000,
      })
      const raw = (resp.choices?.[0]?.message?.content || '').trim()
      const json = this.strictJson<JDExtraction>(raw)
      return json || fallback
    } catch {
      return fallback
    }
  }

  private strictJson<T>(s: string): T | null {
    let t = (s || '').trim()
    if (!t) return null
    if (t.startsWith('```')) {
      t = t.replace(/^```[a-z]*\n?/i, '').replace(/\n?```$/, '')
    }
    try {
      const parsed = JSON.parse(t)
      return parsed as T
    } catch {
      const first = t.indexOf('{')
      const last = t.lastIndexOf('}')
      if (first !== -1 && last !== -1 && last > first) {
        try {
          const candidate = t.slice(first, last + 1)
          return JSON.parse(candidate) as T
        } catch {}
      }
      return null
    }
  }
}


