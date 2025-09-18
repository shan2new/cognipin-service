import { Controller, Post, Req, Res } from '@nestjs/common'
import type { Request, Response } from 'express'
import { ConfigService } from '@nestjs/config'
import { CopilotRuntime, copilotRuntimeNestEndpoint, LangGraphHttpAgent, OpenAIAdapter } from '@copilotkit/runtime'

@Controller('copilotkit')
export class CopilotController {
  constructor(private readonly config: ConfigService) {}
  @Post('chat')
  async chat(@Req() req: Request, @Res() res: Response) {
    try {
      const runtimeUrl = this.config.get<string>('COPILOT_RUNTIME_URL') || ''
      if (!runtimeUrl) {
        return res.status(500).json({ error: 'COPILOT_RUNTIME_URL not configured' })
      }
      const runtime = new CopilotRuntime({
        agents: {
          'sample_agent': new LangGraphHttpAgent({ url: runtimeUrl }),
        },
      });
      // If assistant-ui hits this endpoint directly with { messages, temperature },
      // proxy to LangGraph runtime and return { content } shape
      try {
        const body: any = req.body || {}
        if (Array.isArray(body.messages)) {
          const response = await fetch(runtimeUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ messages: body.messages, temperature: body.temperature ?? 0.3 }),
          } as any)
          const text = await response.text()
          console.log('text', text)
          if (!response.ok) {
            return res.status(response.status).send(text || `LangGraph ${response.status}`)
          }
          try {
            const data = JSON.parse(text)
            console.log('data', data)
            return res.json({ content: data?.content || '' })
          } catch {
            return res.json({ content: text || '' })
          }
        }
      } catch {}

      // Otherwise fall back to CopilotKit runtime handler
      const handler = copilotRuntimeNestEndpoint({ runtime, serviceAdapter: new OpenAIAdapter(), endpoint: '/chat' })
      return handler(req, res)
    } catch (e) {
      res.status(500).json({ error: 'Copilot chat proxy failed' })
    }
  }
}


