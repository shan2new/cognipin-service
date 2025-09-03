import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import OpenAI from 'openai'

@Injectable()
export class AutofillAiService {
  private client: OpenAI | null = null

  constructor(private readonly config: ConfigService) {
    const key = this.config.get<string>('OPENROUTER_API_KEY') || this.config.get<string>('OPENAI_API_KEY')
    if (key) {
      this.client = new OpenAI({
        apiKey: key,
        baseURL: this.config.get<string>('OPENROUTER_BASE_URL') || 'https://openrouter.ai/api/v1',
        defaultHeaders: {
          'HTTP-Referer': 'https://cognipin.com',
          'X-Title': 'Huntier Autofill AI',
        },
      })
    }
  }

  /**
   * Analyze multiple screenshots and optional preview text to suggest improvements
   * to the user's gathered information (JD, LinkedIn, profile posts, etc.)
   */
  async analyzeScreenshots(input: { files?: Array<{ buffer: Buffer; mimetype?: string }>; previewText?: string; jdText?: string }): Promise<{ suggestions: string[] }> {
    if (!this.client) return { suggestions: [] }

    const userContent: any[] = [
      { type: 'text', text: [
        'You will receive several images related to a job opportunity (job description screenshots, LinkedIn posts, or a profile).',
        'You MAY also receive a short preview text that the user has written.',
        'Analyze the evidence and return 5-10 concise improvement suggestions to make their outreach template stronger.',
        'Focus on: missing details (company, role, location), important keywords/skills, measurable highlights to mention, and personalization hooks.',
        'Return a numbered list in plain text (one suggestion per line). No markdown fences.'
      ].join('\n') },
    ]

    for (const f of input.files || []) {
      const b64 = f.buffer?.toString('base64') || ''
      if (!b64) continue
      const dataUrl = `data:${f.mimetype || 'image/png'};base64,${b64}`
      userContent.push({ type: 'image_url', image_url: { url: dataUrl } })
    }
    const textHints: string[] = []
    if (input.previewText) textHints.push(`Preview: ${input.previewText.slice(0, 4000)}`)
    if (input.jdText) textHints.push(`JD: ${input.jdText.slice(0, 4000)}`)
    if (textHints.length) userContent.push({ type: 'text', text: textHints.join('\n---\n') })

    try {
      const resp = await this.client.chat.completions.create({
        model: 'meta-llama/llama-3.2-3b-instruct',
        messages: [
          { role: 'system', content: 'You are a concise assistant for outreach preparation. Provide bullet suggestions.' },
          { role: 'user', content: userContent as any },
        ],
        temperature: 0.2,
        max_tokens: 600,
      })
      const raw = (resp.choices?.[0]?.message?.content || '').trim()
      const lines = raw
        .replace(/^```[\s\S]*?```/g, '')
        .split(/\r?\n/)
        .map((l) => l.replace(/^\s*\d+[.)]\s*/, '').replace(/^[-•]\s*/, '').trim())
        .filter(Boolean)
        .slice(0, 12)
      return { suggestions: lines }
    } catch {
      return { suggestions: [] }
    }
  }

  /**
   * Improve a message template while preserving placeholders like {company} and {role}.
   */
  async improveTemplate(input: { template: string; placeholders: string[]; autofill?: any; resume?: any; jdText?: string; suggestions?: string[] }): Promise<{ improved: string }> {
    const base = { improved: input.template }
    if (!this.client) return base

    const guardList = Array.isArray(input.placeholders) ? input.placeholders : []
    const guardText = guardList.length ? `Placeholders to keep EXACTLY as-is: ${guardList.join(', ')}.` : 'If placeholders like {company} exist, keep them unchanged.'
    const contextObj = {
      template: input.template.slice(0, 8000),
      autofill: input.autofill || {},
      resume: input.resume || {},
      jdText: input.jdText?.slice(0, 6000) || '',
      suggestions: input.suggestions || [],
    }

    try {
      const resp = await this.client.chat.completions.create({
        model: 'mistralai/mistral-small-3.2-24b-instruct:free',
        messages: [
          { role: 'system', content: [
            'You rewrite outreach templates for job applications.',
            'Rules:',
            '- Keep the same language and tone professional, concise, friendly.',
            '- Preserve all placeholders in curly braces exactly as provided. Do not remove or rename them. Do not output code fences.',
            '- Avoid over-the-top salesy tone; keep it direct and value-focused.',
            '- Use 2-4 short paragraphs and up to 3 bullets if appropriate.',
            '- Keep total length under 180 words.'
          ].join('\n') },
          { role: 'user', content: [
            { type: 'text', text: guardText },
            { type: 'text', text: 'Context JSON follows:' },
            { type: 'text', text: JSON.stringify(contextObj).slice(0, 15000) },
            { type: 'text', text: 'Return ONLY the improved message text.' },
          ] as any },
        ],
        temperature: 0.4,
        max_tokens: 800,
      })
      let improved = (resp.choices?.[0]?.message?.content || '').trim()
      improved = improved.replace(/^```[a-z]*\n?/i, '').replace(/\n?```$/, '').trim()

      // Last-resort: ensure placeholders remain
      for (const p of guardList) {
        if (!improved.includes(p)) {
          // Append missing placeholder subtly to preserve downstream filling
          improved += `\n\n${p}: `
        }
      }

      return { improved }
    } catch {
      return base
    }
  }
}


