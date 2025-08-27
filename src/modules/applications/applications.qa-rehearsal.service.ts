import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import OpenAI from 'openai'

export type QASnapshot = {
  current_ctc_text?: string | null
  expected_ctc_text?: string | null
  notice_period_text?: string | null
  reason_leaving_current_text?: string | null
  past_leaving_reasons_text?: string | null
}

export type QARehearsalResponse = {
  responses: {
    current_ctc?: string
    expected_ctc?: string
    notice_period?: string
    reason_leaving?: string
    past_reasons?: string
  }
  pitch: string
  note?: string
}

@Injectable()
export class ApplicationsQARehearsalService {
  private client: OpenAI | null = null

  constructor(private readonly config: ConfigService) {
    const key = this.config.get<string>('OPENROUTER_API_KEY') || this.config.get<string>('OPENAI_API_KEY')
    if (key) {
      this.client = new OpenAI({
        apiKey: key,
        baseURL: this.config.get<string>('OPENROUTER_BASE_URL') || 'https://openrouter.ai/api/v1',
        defaultHeaders: {
          'HTTP-Referer': 'https://cognipin.com',
          'X-Title': 'Huntier Q&A Rehearsal AI',
        },
      })
    }
  }

  async generateRehearsalResponses(qaSnapshot: QASnapshot, role?: string, company?: string): Promise<QARehearsalResponse> {
    const fallback: QARehearsalResponse = {
      responses: {},
      pitch: 'Experienced professional seeking new opportunities.',
      note: 'AI disabled or insufficient data'
    }

    if (!this.client) return fallback

    // Filter out null/undefined values and create context
    const context: Record<string, string> = {}
    if (qaSnapshot.current_ctc_text) context.current_ctc = qaSnapshot.current_ctc_text
    if (qaSnapshot.expected_ctc_text) context.expected_ctc = qaSnapshot.expected_ctc_text
    if (qaSnapshot.notice_period_text) context.notice_period = qaSnapshot.notice_period_text
    if (qaSnapshot.reason_leaving_current_text) context.reason_leaving = qaSnapshot.reason_leaving_current_text
    if (qaSnapshot.past_leaving_reasons_text) context.past_reasons = qaSnapshot.past_leaving_reasons_text

    if (Object.keys(context).length === 0) {
      return { ...fallback, note: 'No QA data available. Add your responses in the application details.' }
    }

    const messages = [
      {
        role: 'system' as const,
        content: [
          'You are an interview coach helping prepare crisp, professional responses.',
          'Transform the provided QA snapshot into interview-ready answers.',
          'Keep responses concise (1-2 sentences), confident, and positive.',
          'For compensation: be specific with numbers when provided.',
          'For leaving reasons: focus on growth, opportunity, and forward momentum.',
          'For notice period: be clear about availability.',
          'Output STRICT JSON with keys: responses (object with optional current_ctc, expected_ctc, notice_period, reason_leaving, past_reasons), pitch (20-second self-introduction), note (optional guidance).',
          'Do NOT invent information not present in the input.',
          'Return only valid JSON with no markdown fences.'
        ].join('\n')
      },
      {
        role: 'user' as const,
        content: JSON.stringify({
          qa_data: context,
          role: role || 'Software Engineer',
          company: company || 'the company'
        })
      }
    ]

    try {
      const resp = await this.client.chat.completions.create({
        model: 'moonshotai/kimi-k2:free',
        messages,
        temperature: 0.3,
        response_format: { type: 'json_object' } as any,
        max_tokens: 800,
      })

      const raw = (resp.choices?.[0]?.message?.content || '').trim()
      const json = this.strictJson<QARehearsalResponse>(raw)
      return json || fallback
    } catch (err) {
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
