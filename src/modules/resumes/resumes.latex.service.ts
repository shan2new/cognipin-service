import { Injectable, Logger } from '@nestjs/common'

@Injectable()
export class ResumesLatexService {
  private readonly logger = new Logger(ResumesLatexService.name)

  list(): Array<{ id: string; name: string; description?: string }> {
    return [
      { id: 'jake-classic', name: 'Jake Classic', description: 'ATS-friendly, single column' },
      { id: 'classic', name: 'Minimal Classic', description: 'Simple article layout' },
      { id: 'modern', name: 'Modern (alias)', description: 'Alias of Minimal Classic' },
    ]
  }

  // Minimal template set; these can be swapped with Overleaf templates later.
  private getTemplate(templateId?: string): string {
    const id = String(templateId || 'classic').toLowerCase()
    const classic = `\\documentclass[11pt,a4paper]{article}
\\usepackage[margin=1in]{geometry}
\\usepackage[T1]{fontenc}
\\usepackage{hyperref}
\\usepackage{enumitem}
\\setlist[itemize]{noitemsep, topsep=2pt, left=0pt}
\\begin{document}
% Header
\\begin{center}
  {\\LARGE {{{fullName}}} \\}\\vspace{2mm}\\par
  {\\normalsize {{{contactLine}}}}\\par
\\end{center}
\\vspace{6mm}
% Summary
{{#if summary}}
\\section*{Professional Summary}
{{summary}}\\par
\\vspace{2mm}
{{/if}}
% Experience
{{#if experience}}
\\section*{Work Experience}
{{#each experience}}
\\textbf{{{{roleCompany}}}}\\par
{{#if dates}}\\textit{{{{dates}}}}\\par{{/if}}
{{#if bullets}}
\\begin{itemize}
{{#each bullets}}
  \item {{this}}
{{/each}}
\\end{itemize}
{{/if}}
\\vspace{2mm}
{{/each}}
{{/if}}
% Education
{{#if education}}
\\section*{Education}
{{#each education}}
{{titleLine}}\\par
{{#if dates}}\\textit{{{{dates}}}}\\par{{/if}}
\\vspace{1mm}
{{/each}}
{{/if}}
% Projects
{{#if projects}}
\\section*{Projects}
{{#each projects}}
\\textbf{{{{name}}}} {{#if url}}(\\href{${'{{url}}'}}{{'{'}}link{{'}'}}){{/if}}\\par
{{#if description}}{{description}}\\par{{/if}}
{{#if highlights}}
\\begin{itemize}
{{#each highlights}}
  \item {{this}}
{{/each}}
\\end{itemize}
{{/if}}
\\vspace{1mm}
{{/each}}
{{/if}}
% Skills
{{#if skills}}
\\section*{Skills}
{{#each skills}}
\\texttt{{{{this}}}} \quad
{{/each}}
{{/if}}
\\end{document}`

    const modern = classic // Placeholder: swap later with another Overleaf-inspired template
    return id === 'modern' ? modern : classic
  }

  private buildJakePreamble(): string {
    return `%-------------------------\n% Resume in Latex (Jake Classic)\n% Based off of: https://github.com/sb2nov/resume\n% License : MIT\n%------------------------\n\\documentclass[letterpaper,11pt]{article}\n\\usepackage{latexsym}\n\\usepackage[empty]{fullpage}\n\\usepackage{titlesec}\n\\usepackage{marvosym}\n\\usepackage[usenames,dvipsnames]{color}\n\\usepackage{verbatim}\n\\usepackage{enumitem}\n\\usepackage[hidelinks]{hyperref}\n\\usepackage{fancyhdr}\n\\usepackage[english]{babel}\n\\usepackage{tabularx}\n\\IfFileExists{glyphtounicode.tex}{\\input{glyphtounicode}}{}\n\\pagestyle{fancy}\n\\fancyhf{}\n\\fancyfoot{}\n\\renewcommand{\\headrulewidth}{0pt}\n\\renewcommand{\\footrulewidth}{0pt}\n\\addtolength{\\oddsidemargin}{-0.5in}\n\\addtolength{\\evensidemargin}{-0.5in}\n\\addtolength{\\textwidth}{1in}\n\\addtolength{\\topmargin}{-.5in}\n\\addtolength{\\textheight}{1.0in}\n\\urlstyle{same}\n\\raggedbottom\n\\raggedright\n\\setlength{\\tabcolsep}{0in}\n\\titleformat{\\section}{\\vspace{-4pt}\\scshape\\raggedright\\large}{}{0em}{}[\\color{black}\\titlerule \\vspace{-5pt}]\n\\pdfgentounicode=1\n\\newcommand{\\resumeItem}[1]{\\item\\small{{#1 \\vspace{-2pt}}}}\n\\newcommand{\\resumeSubheading}[4]{\\vspace{-2pt}\\item\\begin{tabular*}{0.97\\textwidth}[t]{l@{\\extracolsep{\\fill}}r}\\textbf{#1} & #2 \\\\ \\textit{\\small#3} & \\textit{\\small #4} \\\\ \\end{tabular*}\\vspace{-7pt}}\n\\newcommand{\\resumeSubSubheading}[2]{\\item\\begin{tabular*}{0.97\\textwidth}{l@{\\extracolsep{\\fill}}r} \\textit{\\small#1} & \\textit{\\small #2} \\\\ \\end{tabular*}\\vspace{-7pt}}\n\\newcommand{\\resumeProjectHeading}[2]{\\item\\begin{tabular*}{0.97\\textwidth}{l@{\\extracolsep{\\fill}}r} \\small#1 & #2 \\\\ \\end{tabular*}\\vspace{-7pt}}\n\\newcommand{\\resumeSubItem}[1]{\\resumeItem{#1}\\vspace{-4pt}}\n\\renewcommand\\labelitemii{$\\vcenter{\\hbox{\\tiny$\\bullet$}}$}\n\\newcommand{\\resumeSubHeadingListStart}{\\begin{itemize}[leftmargin=0.15in, label={}]}\n\\newcommand{\\resumeSubHeadingListEnd}{\\end{itemize}}\n\\newcommand{\\resumeItemListStart}{\\begin{itemize}}\n\\newcommand{\\resumeItemListEnd}{\\end{itemize}\\vspace{-5pt}}\n`
  }

  private escapeEmail(s: string): string { return this.escapeLatex(String(s || '')) }
  private escapeUrl(s: string): string { return this.escapeLatex(String(s || '')) }

  private renderJakeClassic(resume: any): string {
    const pi = (resume?.personal_info || {}) as any
    const name = String(pi.fullName || resume?.name || 'Your Name')
    const email = pi.email ? `\\href{mailto:${this.escapeEmail(pi.email)}}{\\underline{${this.escapeLatex(pi.email)}}}` : ''
    const phone = pi.phone ? this.escapeLatex(String(pi.phone)) : ''
    const linkedin = pi.linkedin ? `\\href{${this.escapeUrl(pi.linkedin)}}{\\underline{${this.escapeLatex(pi.linkedin)}}}` : ''
    const github = pi.github ? `\\href{${this.escapeUrl(pi.github)}}{\\underline{${this.escapeLatex(pi.github)}}}` : ''
    const contact = [phone, email, linkedin, github].filter(Boolean).join(' $|$ ')

    const edu: any[] = (resume?.sections || []).find((s: any) => s.type === 'education')?.content || resume?.education || []
    const exp: any[] = (resume?.sections || []).find((s: any) => s.type === 'experience')?.content || resume?.experience || []
    const projects: any[] = (resume?.sections || []).find((s: any) => s.type === 'projects')?.content || []
    const skillsGroups: any = (resume?.sections || []).find((s: any) => s.type === 'skills')?.content || { groups: [] }
    const skills: string[] = Array.isArray(skillsGroups?.groups) ? skillsGroups.groups.flatMap((g: any) => Array.isArray(g?.skills) ? g.skills : []) : []

    const eduBlock = edu.map((e) => `\\resumeSubheading{${this.escapeLatex(e?.school || '')}}{${this.escapeLatex(e?.location || '')}}{${this.escapeLatex([e?.degree, e?.field].filter(Boolean).join(' in '))}}{${this.escapeLatex([e?.startDate, e?.endDate].filter(Boolean).join(' -- '))}}`).join('\n')

    const expBlock = exp.map((x) => {
      const bullets: string[] = Array.isArray(x?.bullets) ? x.bullets : []
      const bulletBlock = bullets.map((b) => `\\resumeItem{${this.escapeLatex(b)}}`).join('\n')
      return [
        `\\resumeSubheading{${this.escapeLatex(x?.company || '')}}{${this.escapeLatex(x?.location || '')}}{${this.escapeLatex(x?.role || '')}}{${this.escapeLatex([x?.startDate, x?.endDate].filter(Boolean).join(' -- '))}}`,
        '\\resumeItemListStart',
        bulletBlock,
        '\\resumeItemListEnd',
      ].join('\n')
    }).join('\n\n')

    const projectsBlock = projects.map((p) => {
      const highlights: string[] = Array.isArray(p?.highlights) ? p.highlights : []
      const bullets = highlights.map((h) => `\\resumeItem{${this.escapeLatex(h)}}`).join('\n')
      const when = this.escapeLatex(p?.date || '')
      const techs = Array.isArray(p?.technologies) ? `\\emph{${this.escapeLatex(p.technologies.join(', '))}}` : ''
      return [
        `\\resumeProjectHeading{\\textbf{${this.escapeLatex(p?.name || '')}} $|$ ${techs}}{${when}}`,
        '\\resumeItemListStart',
        bullets,
        '\\resumeItemListEnd',
      ].join('\n')
    }).join('\n\n')

    const skillsBlock = skills.length ? `\\begin{itemize}[leftmargin=0.15in, label={}]\n\\small{\\item{\\textbf{Skills}{: ${this.escapeLatex(skills.join(', '))}}}}\n\\end{itemize}` : ''

    const doc = [
      this.buildJakePreamble(),
      '\\begin{document}',
      '\\begin{center}',
      `  \\textbf{\\Huge \\scshape ${this.escapeLatex(name)}} \\\\ \\vspace{1pt}`,
      contact ? `  \\small ${contact}` : '',
      '\\end{center}',
      edu.length ? '\\section{Education}\n  \\resumeSubHeadingListStart\n' + eduBlock + '\n  \\resumeSubHeadingListEnd' : '',
      exp.length ? '\\section{Experience}\n  \\resumeSubHeadingListStart\n' + expBlock + '\n  \\resumeSubHeadingListEnd' : '',
      projects.length ? '\\section{Projects}\n  \\resumeSubHeadingListStart\n' + projectsBlock + '\n  \\resumeSubHeadingListEnd' : '',
      skillsBlock ? '\\section{Technical Skills}\n' + skillsBlock : '',
      '\\end{document}',
    ].filter(Boolean).join('\n\n')
    return doc
  }

  // Very lightweight templating (Handlebars-like) for the small set we need
  private renderTemplate(template: string, data: Record<string, any>): string {
    let out = template
    // Simple {{key}} replacements
    for (const [k, v] of Object.entries(data)) {
      if (typeof v === 'string') {
        const safe = this.escapeLatex(v)
        out = out.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), safe)
      }
    }
    // Lists replacements via {{#each list}} ... {{/each}}
    out = out.replace(/\{\{#each ([^}]+)\}\}([\s\S]*?)\{\{\/each\}\}/g, (_m, name: string, block: string) => {
      const list: any[] = Array.isArray((data as any)[name]) ? (data as any)[name] : []
      return list.map((item) => this.renderBlock(block, item)).join('')
    })
    // Conditionals {{#if key}} ... {{/if}}
    out = out.replace(/\{\{#if ([^}]+)\}\}([\s\S]*?)\{\{\/if\}\}/g, (_m, name: string, block: string) => {
      const val = (data as any)[name]
      const truthy = Array.isArray(val) ? val.length > 0 : !!val
      return truthy ? this.renderBlock(block, data) : ''
    })
    return out
  }

  private renderBlock(block: string, context: any): string {
    return block.replace(/\{\{([^}]+)\}\}/g, (_m, key: string) => {
      const value = this.lookup(context, key.trim())
      const str = typeof value === 'string' ? value : (value == null ? '' : String(value))
      return this.escapeLatex(str)
    })
  }

  private lookup(obj: any, path: string) {
    if (path === 'this') return obj
    return path.split('.').reduce((acc: any, k: string) => (acc && typeof acc === 'object' ? acc[k] : undefined), obj)
  }

  private escapeLatex(s: string): string {
    return String(s)
      .replace(/\\/g, '\\textbackslash{}')
      .replace(/([%#&_{}])/g, '\\$1')
      .replace(/\$/g, '\\$')
      .replace(/\^/g, '\\^{}')
      .replace(/~/g, '\\textasciitilde{}')
  }

  // Build a normalized render context from resume JSON
  buildRenderContext(resume: any) {
    const pi = (resume?.personal_info || {}) as any
    const contactLine = [pi.email, pi.phone, pi.location].filter(Boolean).join(' \\textbullet{} ')
    const summary = (resume?.sections || []).find((s: any) => s.type === 'summary')?.content?.text || resume?.summary || ''
    const experience: any[] = (resume?.sections || []).find((s: any) => s.type === 'experience')?.content || resume?.experience || []
    const education: any[] = (resume?.sections || []).find((s: any) => s.type === 'education')?.content || resume?.education || []
    const projects: any[] = (resume?.sections || []).find((s: any) => s.type === 'projects')?.content || []
    const skillsGroups: any = (resume?.sections || []).find((s: any) => s.type === 'skills')?.content || { groups: [] }
    const skills: string[] = Array.isArray(skillsGroups?.groups) ? skillsGroups.groups.flatMap((g: any) => Array.isArray(g?.skills) ? g.skills : []) : []

    return {
      fullName: String(pi.fullName || resume?.name || 'Your Name'),
      contactLine,
      summary,
      experience: (Array.isArray(experience) ? experience : []).map((it: any) => ({
        roleCompany: [it?.role, (it?.company && it?.role) ? `at ${it.company}` : (it?.company || '')].filter(Boolean).join(' '),
        dates: [it?.startDate, it?.endDate].filter(Boolean).join(' - '),
        bullets: Array.isArray(it?.bullets) ? it.bullets : [],
      })),
      education: (Array.isArray(education) ? education : []).map((it: any) => ({
        titleLine: [it?.degree && it?.field ? `${it.degree} in ${it.field}` : (it?.degree || it?.field || ''), it?.school].filter(Boolean).join(', '),
        dates: [it?.startDate, it?.endDate].filter(Boolean).join(' - '),
      })),
      projects: (Array.isArray(projects) ? projects : []).map((it: any) => ({
        name: it?.name || '',
        url: it?.url || '',
        description: it?.description || '',
        highlights: Array.isArray(it?.highlights) ? it.highlights : [],
      })),
      skills,
    }
  }

  renderTex(resume: any, templateId?: string): string {
    const id = String(templateId || '').toLowerCase()
    if (!id || id === 'jake-classic') {
      return this.renderJakeClassic(resume)
    }
    const tpl = this.getTemplate(id)
    const ctx = this.buildRenderContext(resume)
    return this.renderTemplate(tpl, ctx)
  }

  async compilePdf(tex: string): Promise<Buffer> {
    // CLI-based approach using node-latex (streams to PDF)
    // node-latex is already a dependency in package.json
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const latex = require('node-latex')
    return await new Promise<Buffer>((resolve, reject) => {
      try {
        const stream = latex(tex)
        const chunks: Buffer[] = []
        stream.on('data', (c: Buffer) => chunks.push(c))
        stream.on('error', (err: any) => reject(err))
        stream.on('finish', () => resolve(Buffer.concat(chunks)))
      } catch (e) {
        reject(e)
      }
    })
  }
}


