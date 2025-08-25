import { Injectable } from '@nestjs/common'
import { Resume } from '../../schema/resume.entity'
import { Document, Packer, Paragraph, TextRun } from 'docx'
import puppeteer from 'puppeteer'

@Injectable()
export class ResumesExportService {
  async toDocx(resume: Resume): Promise<Buffer> {
    const doc = new Document({
      sections: [
        {
          children: [
            new Paragraph({
              children: [new TextRun({ text: resume.name || 'Resume', bold: true, size: 28 })],
            }),
            ...this.summaryParas(resume as any),
            ...this.bulletsSection('Experience', ((resume as any).sections || []).find((s: any) => s.type === 'experience')?.content || []),
            ...this.bulletsSection('Achievements', ((resume as any).sections || []).find((s: any) => s.type === 'achievements')?.content || []),
            ...this.bulletsSection('Projects', ((resume as any).sections || []).find((s: any) => s.type === 'projects')?.content || []),
            ...this.bulletsSection('Education', ((resume as any).sections || []).find((s: any) => s.type === 'education')?.content || []),
            ...this.skillsParas(((resume as any).sections || []).find((s: any) => s.type === 'skills')?.content || { groups: [] }),
          ],
        },
      ],
    })

    return await Packer.toBuffer(doc)
  }

  async toPdf(resume: Resume): Promise<Buffer> {
    const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] })
    try {
      const page = await browser.newPage()
      const html = this.renderHtml(resume as any)
      await page.setContent(html, { waitUntil: 'networkidle0' })
      const pdf = await page.pdf({ format: 'A4', printBackground: true, margin: { top: '0.6in', bottom: '0.6in', left: '0.6in', right: '0.6in' } })
      return Buffer.from(pdf)
    } finally {
      await browser.close()
    }
  }

  private summaryParas(resume: any) {
    const text = resume?.sections?.find((s: any) => s.type === 'summary')?.content?.text || resume.summary
    if (!text) return []
    return [
      new Paragraph({ children: [new TextRun({ text: 'Summary', bold: true })] }),
      new Paragraph({ children: [new TextRun({ text })] }),
    ]
  }

  private bulletsSection(title: string, items: Array<any>) {
    if (!items || items.length === 0) return []
    return [
      new Paragraph({ children: [new TextRun({ text: title, bold: true })] }),
      ...items.map((i) => new Paragraph({ text: `• ${i?.text ?? ''}` })),
    ]
  }

  private renderHtml(resume: any): string {
    const summary = resume?.sections?.find((s: any) => s.type === 'summary')?.content?.text || ''
    const experience: Array<any> = resume?.sections?.find((s: any) => s.type === 'experience')?.content || []
    const achievements: Array<any> = resume?.sections?.find((s: any) => s.type === 'achievements')?.content || []
    const projects: Array<any> = resume?.sections?.find((s: any) => s.type === 'projects')?.content || []
    const education: Array<any> = resume?.sections?.find((s: any) => s.type === 'education')?.content || []
    const skills: any = resume?.sections?.find((s: any) => s.type === 'skills')?.content || { groups: [] }
    return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      body { font-family: -apple-system, Inter, system-ui, Segoe UI, Roboto, Arial, sans-serif; color: #0a0a0a; }
      h1 { font-size: 22px; margin: 0 0 8px; }
      h2 { font-size: 14px; margin: 16px 0 6px; }
      p, li { font-size: 12px; line-height: 1.5; }
      ul { margin: 0; padding-left: 16px; }
      .muted { color: #555; }
      .header { border-bottom: 1px solid #e5e5e5; padding-bottom: 8px; margin-bottom: 12px; }
    </style>
  </head>
  <body>
    <div class="header">
      <h1>${escapeHtml(resume?.personal_info?.fullName || 'Your Name')}</h1>
      <p class="muted">${escapeHtml(resume?.personal_info?.email || '')} ${escapeHtml(resume?.personal_info?.phone || '')}</p>
    </div>
    ${summary ? `<h2>Professional Summary</h2><p>${escapeHtml(summary)}</p>` : ''}
    ${experience.length ? `<h2>Work Experience</h2><ul>${experience.map((i: any) => `<li>${escapeHtml(i?.text || '')}</li>`).join('')}</ul>` : ''}
    ${projects.length ? `<h2>Projects</h2><ul>${projects.map((i: any) => `<li>${escapeHtml(i?.text || '')}</li>`).join('')}</ul>` : ''}
    ${education.length ? `<h2>Education</h2><ul>${education.map((i: any) => `<li>${escapeHtml(i?.text || '')}</li>`).join('')}</ul>` : ''}
    ${achievements.length ? `<h2>Achievements</h2><ul>${achievements.map((i: any) => `<li>${escapeHtml(i?.text || '')}</li>`).join('')}</ul>` : ''}
    ${Array.isArray(skills.groups) && skills.groups.length ? `<h2>Skills</h2><ul>${skills.groups.map((g: any) => `<li>${escapeHtml(g?.name || '')}: ${escapeHtml(Array.isArray(g?.items) ? g.items.join(', ') : '')}</li>`).join('')}</ul>` : ''}
  </body>
</html>`
  }

  private skillsParas(skills: { groups: Array<{ name: string; items: string[] }> }) {
    if (!skills || !Array.isArray(skills.groups) || !skills.groups.length) return []
    return [
      new Paragraph({ children: [new TextRun({ text: 'Skills', bold: true })] }),
      ...skills.groups.map((g) => new Paragraph({ text: `${g?.name || ''}: ${(Array.isArray(g?.items) ? g.items.join(', ') : '')}` })),
    ]
  }
}

function escapeHtml(s: string) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}


