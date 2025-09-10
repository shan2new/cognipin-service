import { Controller, Post, Req, Res, UseGuards } from '@nestjs/common'
import type { Request, Response } from 'express'
import { ConfigService } from '@nestjs/config'
import { CopilotRuntime, copilotRuntimeNestEndpoint, LangGraphHttpAgent, OpenAIAdapter } from '@copilotkit/runtime'
import { ClerkGuard } from '../auth/clerk.guard'

@Controller('copilotkit')
@UseGuards(ClerkGuard)
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
          'sample_agent': new LangGraphHttpAgent({url: "http://localhost:8000/chat"}),
        },
      });
      const handler = copilotRuntimeNestEndpoint({
        runtime,
        serviceAdapter: new OpenAIAdapter(),
        endpoint: '/chat',
      });
      return handler(req, res);
    } catch (e) {
      res.status(500).json({ error: 'Copilot chat proxy failed' })
    }
  }
}


