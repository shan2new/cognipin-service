import { Injectable } from '@nestjs/common'
import { Resume } from '../../schema/resume.entity'
import { Document, Packer, Paragraph, TextRun } from 'docx'
import puppeteer from 'puppeteer'

@Injectable()
export class ResumesExportService {
  private themeSpec(id?: string) {
    const theme = String(id || '').toLowerCase()
    const base = {
      fontFamily: 'Inter, -apple-system, system-ui, Segoe UI, Roboto, Arial, sans-serif',
      headingColor: '#111827',
      bodyColor: '#374151',
      mutedColor: '#6b7280',
      divider: '#e5e7eb',
      chipBg: '#f4f4f5',
      chipBorder: '#e5e7eb',
      chipText: '#6b7280',
    }
    const map: Record<string, Partial<typeof base>> = {
      elegant: {
        fontFamily: 'Georgia, ui-serif, serif',
        headingColor: '#4338ca',
        chipBg: '#eef2ff',
        chipBorder: '#e0e7ff',
        chipText: '#4338ca',
      },
      modern: {
        headingColor: '#111827',
      },
      mono: {
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
        headingColor: '#27272a',
        bodyColor: '#27272a',
        chipText: '#3f3f46',
      },
      serif: {
        fontFamily: 'ui-serif, Georgia, Cambria, "Times New Roman", Times, serif',
        headingColor: '#1c1917',
        bodyColor: '#292524',
      },
      gradient: {
        headingColor: '#7c3aed',
        chipBg: '#fdf4ff',
        chipBorder: '#fae8ff',
        chipText: '#7c3aed',
      },
      slate: {
        headingColor: '#1f2937',
        bodyColor: '#334155',
        chipBg: '#f1f5f9',
        chipBorder: '#e2e8f0',
        chipText: '#475569',
      },
      emerald: {
        headingColor: '#047857',
        chipBg: '#ecfdf5',
        chipBorder: '#d1fae5',
        chipText: '#065f46',
      },
      royal: {
        headingColor: '#6d28d9',
        chipBg: '#f5f3ff',
        chipBorder: '#ede9fe',
        chipText: '#5b21b6',
      },
      classic: {
        bodyColor: '#111827',
        chipBg: '#f9fafb',
        chipBorder: '#e5e7eb',
        chipText: '#374151',
      },
      minimal: {},
    }
    return { ...base, ...(map[theme] || {}) }
  }

  private themeCss(id?: string) {
    const t = this.themeSpec(id)
    return `
      body { font-family: ${t.fontFamily}; color: ${t.bodyColor}; }
      h1 { color: ${t.headingColor}; }
      h2 { color: ${t.headingColor}; }
      .muted { color: ${t.mutedColor}; }
      .header { border-bottom: 1px solid ${t.divider}; }
      .chip { background: ${t.chipBg}; border-color: ${t.chipBorder}; color: ${t.chipText}; }
    `
  }
  async toDocx(resume: Resume): Promise<Buffer> {
    const doc = new Document({
      sections: [
        {
          children: [
            new Paragraph({
              children: [new TextRun({ text: (resume as any)?.personal_info?.fullName || resume.name || 'Resume', bold: true, size: 28 })],
            }),
            ...this.contactParas(resume as any),
            ...this.summaryParas(resume as any),
            ...this.experienceSection(((resume as any).sections || []).find((s: any) => s.type === 'experience')?.content || []),
            ...this.educationSection(((resume as any).sections || []).find((s: any) => s.type === 'education')?.content || []),
            ...this.achievementsSection(((resume as any).sections || []).find((s: any) => s.type === 'achievements')?.content || []),
            ...this.skillsParas(((resume as any).sections || []).find((s: any) => s.type === 'skills')?.content || { groups: [] }),
            ...this.projectsSection(((resume as any).sections || []).find((s: any) => s.type === 'projects')?.content || []),
          ],
        },
      ],
    })

    return await Packer.toBuffer(doc)
  }

  async toPdf(resume: Resume, bearerToken?: string): Promise<Buffer> {
    const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] })
    try {
      const page = await browser.newPage()
      const frontend = process.env.FRONTEND_URL || process.env.APP_URL || process.env.WEB_URL
      if (frontend && bearerToken) {
        const url = `${frontend.replace(/\/$/, '')}/p/resumes/${(resume as any).id}?token=${encodeURIComponent(bearerToken)}`
        await page.goto(url, { waitUntil: 'networkidle0' })
        // Ensure fonts are loaded so the layout height is stable before printing
        try { await page.evaluate(() => (document as any).fonts && (document as any).fonts.ready) } catch {}
        // Inject theme overrides to match client theme id
        await page.addStyleTag({ content: this.themeCss((resume as any)?.theme?.id) })
      } else {
        const html = this.renderHtml(resume as any)
        await page.setContent(html, { waitUntil: 'networkidle0' })
      }
      // Force white background and remove visual canvas shadow to avoid dark borders
      await page.addStyleTag({ content: 'html,body,.document-viewer{background:#ffffff !important;} .resume-document{box-shadow:none !important;background:#ffffff !important;}' })
      await page.emulateMediaType('print')
      // Use A4 with CSS-defined page size so long resumes paginate correctly
      await page.setViewport({ width: 794, height: 1123, deviceScaleFactor: 2 })
      const pdf = await page.pdf({
        format: 'A4',
        printBackground: true,
        preferCSSPageSize: true,
        // Let @page margins control whitespace; keep Puppeteer margins zero
        margin: { top: '0', bottom: '0', left: '0', right: '0' },
      })
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

  private contactParas(resume: any) {
    const pi = resume?.personal_info || {}
    const contactParts: string[] = []
    if (pi.email) contactParts.push(String(pi.email))
    if (pi.phone) contactParts.push(String(pi.phone))
    if (pi.location) contactParts.push(String(pi.location))
    if (contactParts.length === 0) return []
    return [new Paragraph({ children: [new TextRun({ text: contactParts.join(' • '), color: '666666' })] })]
  }

  private experienceSection(items: Array<any>) {
    if (!Array.isArray(items) || items.length === 0) return []
    const out: Paragraph[] = []
    out.push(new Paragraph({ children: [new TextRun({ text: 'Work Experience', bold: true })] }))
    for (const item of items) {
      const role = item?.role || ''
      const company = item?.company || ''
      const start = item?.startDate || ''
      const end = item?.endDate || ''
      const header = [role, company && role ? `at ${company}` : company].filter(Boolean).join(' ')
      const dates = [start, end].filter(Boolean).join(' - ')
      out.push(new Paragraph({ children: [new TextRun({ text: header, bold: true })] }))
      if (dates) out.push(new Paragraph({ children: [new TextRun({ text: dates, color: '666666' })] }))
      const bullets: string[] = Array.isArray(item?.bullets) ? item.bullets : []
      for (const b of bullets) {
        if (!b) continue
        out.push(new Paragraph({ text: `• ${b}` }))
      }
    }
    return out
  }

  private educationSection(items: Array<any>) {
    if (!Array.isArray(items) || items.length === 0) return []
    const out: Paragraph[] = []
    out.push(new Paragraph({ children: [new TextRun({ text: 'Education', bold: true })] }))
    for (const item of items) {
      const school = item?.school || ''
      const degree = item?.degree || ''
      const field = item?.field || ''
      const start = item?.startDate || ''
      const end = item?.endDate || ''
      const title = [degree, field].filter(Boolean).join(' in ')
      const line = [title, school].filter(Boolean).join(', ')
      const dates = [start, end].filter(Boolean).join(' - ')
      if (line) out.push(new Paragraph({ children: [new TextRun({ text: line })] }))
      if (dates) out.push(new Paragraph({ children: [new TextRun({ text: dates, color: '666666' })] }))
    }
    return out
  }

  private achievementsSection(items: Array<any>) {
    if (!Array.isArray(items) || items.length === 0) return []
    const out: Paragraph[] = []
    out.push(new Paragraph({ children: [new TextRun({ text: 'Achievements', bold: true })] }))
    for (const item of items) {
      const title = item?.title || ''
      const desc = item?.description || ''
      const date = item?.date || ''
      const head = [title, date].filter(Boolean).join(' — ')
      if (head) out.push(new Paragraph({ children: [new TextRun({ text: head })] }))
      if (desc) out.push(new Paragraph({ children: [new TextRun({ text: desc })] }))
    }
    return out
  }

  private projectsSection(items: Array<any>) {
    if (!Array.isArray(items) || items.length === 0) return []
    const out: Paragraph[] = []
    out.push(new Paragraph({ children: [new TextRun({ text: 'Projects', bold: true })] }))
    for (const item of items) {
      const name = item?.name || ''
      const url = item?.url || ''
      const desc = item?.description || ''
      const head = [name, url].filter(Boolean).join(' — ')
      if (head) out.push(new Paragraph({ children: [new TextRun({ text: head, bold: true })] }))
      if (desc) out.push(new Paragraph({ children: [new TextRun({ text: desc })] }))
      const highlights: string[] = Array.isArray(item?.highlights) ? item.highlights : []
      for (const h of highlights) {
        if (!h) continue
        out.push(new Paragraph({ text: `• ${h}` }))
      }
    }
    return out
  }

  private renderHtml(resume: any): string {
    const summary = resume?.sections?.find((s: any) => s.type === 'summary')?.content?.text || ''
    const experience: Array<any> = resume?.sections?.find((s: any) => s.type === 'experience')?.content || []
    const achievements: Array<any> = resume?.sections?.find((s: any) => s.type === 'achievements')?.content || []
    const education: Array<any> = resume?.sections?.find((s: any) => s.type === 'education')?.content || []
    const skills: any = resume?.sections?.find((s: any) => s.type === 'skills')?.content || { groups: [] }
    const certifications: Array<any> = resume?.sections?.find((s: any) => s.type === 'certifications')?.content || []
    const projects: Array<any> = resume?.sections?.find((s: any) => s.type === 'projects')?.content || []
    // Merge any additional_section typed as certifications to be safe
    try {
      const extraCerts = Array.isArray((resume as any).additional_section)
        ? (resume as any).additional_section.filter((s: any) => s?.type === 'certifications').flatMap((s: any) => Array.isArray(s?.content) ? s.content : [])
        : []
      if (extraCerts.length) {
        certifications.push(...extraCerts)
      }
    } catch (e) {
      // ignore additional_section merge errors
    }
    const themeCss = this.themeCss(resume?.theme?.id)
    return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      :root { --foreground: #111827; --muted: #f4f4f5; --muted-foreground: #6b7280; --border: #e5e7eb; }
      body { font-family: Inter, -apple-system, system-ui, Segoe UI, Roboto, Arial, sans-serif; color: var(--foreground); background: white; }
      h1 { font-size: 30px; margin: 0 0 12px; font-weight: 700; }
      h2 { font-size: 12px; margin: 16px 0 6px; text-transform: uppercase; letter-spacing: 0.12em; font-weight: 600; }
      p, li { font-size: 14px; line-height: 1.7; color: #374151; }
      ul { margin: 0; padding-left: 16px; }
      .muted { color: var(--muted-foreground); }
      .header { border-bottom: 1px solid var(--border); padding-bottom: 16px; margin-bottom: 24px; text-align: center; }
      .chip { display: inline-block; padding: 2px 8px; font-size: 12px; border: 1px solid var(--border); background: var(--muted); color: var(--muted-foreground); border-radius: 6px; margin: 2px; }
      .container { width: 794px; min-height: 1123px; margin: 0 auto; padding: 64px; }
      ${themeCss}
    </style>
  </head>
  <body>
    <div class="container">
      <div class="header">
        <h1>${escapeHtml(resume?.personal_info?.fullName || 'Your Name')}</h1>
        <p class="muted">${escapeHtml([resume?.personal_info?.email, resume?.personal_info?.phone, resume?.personal_info?.location].filter(Boolean).join(' • '))}</p>
      </div>
      ${summary ? `<h2>Professional Summary</h2><p>${escapeHtml(summary)}</p>` : ''}
      ${experience.length ? `<h2>Work Experience</h2>${experience.map((i: any) => {
        const header = [i?.role, (i?.company && i?.role) ? `at ${i.company}` : (i?.company || '')].filter(Boolean).join(' ')
        const dates = [i?.startDate, i?.endDate].filter(Boolean).join(' - ')
        const bullets = Array.isArray(i?.bullets) ? i.bullets : []
        return `<p><strong>${escapeHtml(header)}</strong></p>`
          + (dates ? `<p class="muted">${escapeHtml(dates)}</p>` : '')
          + (bullets.length ? `<ul>${bullets.map((b: string) => `<li>${escapeHtml(b)}</li>`).join('')}</ul>` : '')
      }).join('')}` : ''}
      ${education.length ? `<h2>Education</h2>${education.map((i: any) => {
        const title = [i?.degree, i?.field].filter(Boolean).join(' in ')
        const line = [title, i?.school].filter(Boolean).join(', ')
        const dates = [i?.startDate, i?.endDate].filter(Boolean).join(' - ')
        return `<p>${escapeHtml(line)}</p>` + (dates ? `<p class="muted">${escapeHtml(dates)}</p>` : '')
      }).join('')}` : ''}
      ${achievements.length ? `<h2>Achievements</h2>${achievements.map((i: any) => {
        const head = [i?.title, i?.date].filter(Boolean).join(' — ')
        return `<p>${escapeHtml(head)}</p>` + (i?.description ? `<p>${escapeHtml(i.description)}</p>` : '')
      }).join('')}` : ''}
      ${projects.length ? `<h2>Projects</h2>${projects.map((i: any) => {
        const head = [i?.name, i?.url].filter(Boolean).join(' — ')
        const highlights = Array.isArray(i?.highlights) ? i.highlights : []
        return `<p><strong>${escapeHtml(head)}</strong></p>`
          + (i?.description ? `<p>${escapeHtml(i.description)}</p>` : '')
          + (highlights.length ? `<ul>${highlights.map((h: string) => `<li>${escapeHtml(h)}</li>`).join('')}</ul>` : '')
      }).join('')}` : ''}
      ${Array.isArray(skills.groups) && skills.groups.length ? `<h2>Skills</h2>${skills.groups.flatMap((g: any) => Array.isArray(g?.skills) ? g.skills : []).map((s: string) => `<span class="chip">${escapeHtml(s)}</span>`).join('')}` : ''}
    </div>
  </body>
</html>`
  }

  private skillsParas(skills: { groups: Array<{ name: string; skills: string[] }> }) {
    if (!skills || !Array.isArray(skills.groups) || !skills.groups.length) return []
    return [
      new Paragraph({ children: [new TextRun({ text: 'Skills', bold: true })] }),
      ...skills.groups.map((g) => new Paragraph({ text: `${g?.name || ''}: ${(Array.isArray(g?.skills) ? g.skills.join(', ') : '')}` })),
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


