import { Body, Controller, Get, Post, UploadedFiles, UseGuards, UseInterceptors } from '@nestjs/common'
import { AutofillService } from './autofill.service'
import { ClerkGuard } from '../auth/clerk.guard'
import { CurrentUser, RequestUser } from '../auth/current-user.decorator'
import { FilesInterceptor } from '@nestjs/platform-express'
import { AutofillAiService } from './autofill.ai.service'

@Controller('v1/autofill')
@UseGuards(ClerkGuard)
export class AutofillController {
  constructor(private readonly service: AutofillService, private readonly ai: AutofillAiService) {}

  @Get('state')
  async getState(@CurrentUser() user: RequestUser) {
    const row = await this.service.get(user.userId)
    return { state: row.state, updated_at: row.updated_at }
  }

  @Post('state')
  async saveState(@CurrentUser() user: RequestUser, @Body() body: { state: any }) {
    const row = await this.service.update(user.userId, body?.state || {})
    return { success: true, state: row.state, updated_at: row.updated_at }
  }

  // AI: analyze pasted/uploaded screenshots + current preview text
  @Post('ai/analyze')
  @UseInterceptors(FilesInterceptor('files'))
  async analyze(
    @UploadedFiles() files: Array<any>,
    @Body() body: { previewText?: string; jdText?: string }
  ) {
    const out = await this.ai.analyzeScreenshots({ files, previewText: body?.previewText, jdText: body?.jdText })
    return out
  }

  // AI: improve a template while preserving placeholders
  @Post('ai/improve-template')
  async improveTemplate(@Body() body: { template: string; placeholders?: string[]; autofill?: any; resume?: any; jdText?: string; suggestions?: string[] }) {
    const out = await this.ai.improveTemplate({
      template: String(body?.template || ''),
      placeholders: Array.isArray(body?.placeholders) ? body!.placeholders! : [],
      autofill: body?.autofill,
      resume: body?.resume,
      jdText: body?.jdText,
      suggestions: Array.isArray(body?.suggestions) ? body!.suggestions! : [],
    })
    return out
  }
}


