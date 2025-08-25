import { Controller, Get, Post, Put, Delete, Param, Body, UseGuards, Req, UploadedFile, UseInterceptors, Res, Query, Inject } from '@nestjs/common'
import { ResumesService } from './resumes.service'
// Import type only to avoid ts-node resolution issues in lint stage
type Resume = any
import { ResumesAiService } from './resumes.ai.service'
import { ResumesExportService } from './resumes.export.service'
import type { Response } from 'express'
import { FileInterceptor } from '@nestjs/platform-express'
import { ClerkGuard } from '../auth/clerk.guard'

@Controller('v1/resumes')
@UseGuards(ClerkGuard)
export class ResumesController {
  constructor(
    private readonly resumesService: ResumesService,
    private readonly ai: ResumesAiService,
    private readonly exporter: ResumesExportService,
  ) {}

  @Get()
  async findAll(@Req() req: any) {
    return this.resumesService.findAllByUser(req.user.id)
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @Req() req: any) {
    const resume = await this.resumesService.findOne(id, req.user.id)
    if (!resume) {
      throw new Error('Resume not found')
    }
    return resume
  }

  @Post()
  async create(@Body() data: Partial<Resume>, @Req() req: any) {
    return this.resumesService.create(req.user.id, data)
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() data: Partial<Resume>, @Req() req: any) {
    const resume = await this.resumesService.update(id, req.user.id, data)
    if (!resume) {
      throw new Error('Resume not found')
    }
    return resume
  }

  @Post(':id/duplicate')
  async duplicate(@Param('id') id: string, @Req() req: any) {
    const resume = await this.resumesService.duplicate(id, req.user.id)
    if (!resume) {
      throw new Error('Resume not found')
    }
    return resume
  }

  @Post(':id/set-default')
  async setDefault(@Param('id') id: string, @Req() req: any) {
    const resume = await this.resumesService.setDefault(id, req.user.id)
    if (!resume) {
      throw new Error('Resume not found')
    }
    return resume
  }

  @Delete(':id')
  async delete(@Param('id') id: string, @Req() req: any) {
    const success = await this.resumesService.delete(id, req.user.id)
    if (!success) {
      throw new Error('Resume not found')
    }
    return { success }
  }

  // --- AI helpers ---
  @Post(':id/ai/suggest-summary')
  async suggestSummary(@Param('id') id: string, @Req() req: any, @Body() body: { job?: string }) {
    const resume = await this.resumesService.findOne(id, req.user.id)
    if (!resume) throw new Error('Resume not found')
    return this.ai.suggestSummary({ personal_info: (resume as any).personal_info, sections: (resume as any).sections, job: body?.job })
  }

  @Post(':id/ai/suggest-bullets')
  async suggestBullets(@Param('id') id: string, @Req() req: any, @Body() body: { sectionId?: string; role?: string; jd?: string }) {
    const resume = await this.resumesService.findOne(id, req.user.id)
    if (!resume) throw new Error('Resume not found')
    return this.ai.suggestBullets({ role: body?.role, jd: body?.jd, experience: (resume as any).sections })
  }

  @Post(':id/ai/keywords')
  async extractKeywords(@Param('id') id: string, @Req() req: any, @Body() body: { jd: string }) {
    const resume = await this.resumesService.findOne(id, req.user.id)
    if (!resume) throw new Error('Resume not found')
    return this.ai.extractKeywords({ jd: body?.jd, resume })
  }

  // --- Import ---
  @Post('import/linkedin')
  async importLinkedIn(@Req() req: any, @Body() body: { html?: string; url?: string }) {
    // Get structured sections only from public content using AI extraction (no LinkedIn OAuth)
    return this.ai.importFromLinkedIn({ html: body?.html, url: body?.url })
  }

  @Post('import/pdf')
  @UseInterceptors(FileInterceptor('file'))
  async importPdf(@Req() req: any, @UploadedFile() file?: any) {
    // TODO: run OCR or structured PDF parser service
    return { sections: [], personal_info: {}, note: `Received file ${file?.originalname || 'unknown'}` }
  }

  // --- Export ---
  @Get(':id/export')
  async export(@Param('id') id: string, @Req() req: any, @Res() res: Response, @Query('format') format?: 'pdf' | 'docx') {
    const resume = await this.resumesService.findOne(id, req.user.id)
    if (!resume) throw new Error('Resume not found')
    const fmt = (format || 'pdf').toLowerCase()
    if (fmt === 'docx') {
      const buf = await this.exporter.toDocx(resume)
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')
      res.setHeader('Content-Disposition', `attachment; filename="resume-${resume.id}.docx"`)
      return res.send(buf)
    } else {
      const buf = await this.exporter.toPdf(resume)
      res.setHeader('Content-Type', 'application/pdf')
      res.setHeader('Content-Disposition', `attachment; filename="resume-${resume.id}.pdf"`)
      return res.send(buf)
    }
  }
}
