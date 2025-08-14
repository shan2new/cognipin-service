import { setTimeout as delay } from 'node:timers/promises'

export type FetchedMeta = {
  name: string | null
  logoBase64: string | null
  canonicalHost: string // scheme+host lowercased w/o www
}

function canonicalize(url: string): string {
  const u = new URL(url)
  const host = u.host.replace(/^www\./i, '')
  return `${u.protocol}//${host}`.toLowerCase()
}

async function fetchHeadHtml(url: string, timeoutMs = 5000): Promise<string> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(url, { method: 'GET', signal: controller.signal })
    const html = await res.text()
    const headMatch = html.match(/<head[\s\S]*?<\/head>/i)
    return headMatch ? headMatch[0] : ''
  } finally {
    clearTimeout(timeout)
  }
}

function cleanSegment(segment: string): string {
  return segment.replace(/\s+/g, ' ').trim()
}

function parseCompanyNameFromTitle(rawTitle: string): string {
  const title = rawTitle.trim()
  // Case 1: some text | Company → take the last segment
  if (title.includes('|')) {
    const parts = title.split('|').map((p) => cleanSegment(p))
    const last = parts[parts.length - 1]
    if (last) return last
  }
  // Case 2: Company - some text → take the first segment (handle -, –, —)
  const dashMatch = title.split(/\s*[\-–—]\s*/)
  if (dashMatch.length > 1) {
    const first = cleanSegment(dashMatch[0])
    if (first) return first
  }
  // Fallback: direct title
  return cleanSegment(title)
}

function deriveNameFromHead(headHtml: string): string | null {
  // Try og:site_name first
  const og = headHtml.match(/<meta[^>]*property=["']og:site_name["'][^>]*content=["']([^"']+)/i)
  if (og && og[1]) return parseCompanyNameFromTitle(og[1])

  // Fallback to <title>
  const title = headHtml.match(/<title>([^<]+)<\/title>/i)
  if (title && title[1]) {
    return parseCompanyNameFromTitle(title[1])
  }
  return null
}

function sanitizeUrl(input: string, base: URL): string | null {
  try {
    const abs = new URL(input, base)
    let href = abs.toString().trim()
    // If the path is not root, strip trailing slashes/backslashes
    if (abs.pathname && abs.pathname !== '/') {
      href = href.replace(/[\\/]+$/g, '')
    }
    return href
  } catch {
    return null
  }
}

function preferLogoUrl(headHtml: string, base: URL): string | null {
  const ogImage = headHtml.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)/i)
  if (ogImage && ogImage[1]) {
    const cleaned = sanitizeUrl(ogImage[1], base)
    if (cleaned) return cleaned
  }

  // favicon.svg
  const svg = sanitizeUrl('/favicon.svg', base)
  if (svg) return svg

  // fallback ico
  const ico = sanitizeUrl('/favicon.ico', base)
  if (ico) return ico
  return null
}

async function fetchAsBase64(url: string, capBytes = 100 * 1024): Promise<string | null> {
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    const contentType = res.headers.get('content-type') || 'application/octet-stream'
    const buf = new Uint8Array(await res.arrayBuffer())
    if (buf.byteLength > capBytes) return null
    const base64 = Buffer.from(buf).toString('base64')
    return `data:${contentType};base64,${base64}`
  } catch {
    return null
  }
}

export async function fetchMetadata(rawUrl: string): Promise<FetchedMeta> {
  const canon = canonicalize(rawUrl)
  const canonUrl = new URL(canon)
  const head = await fetchHeadHtml(canon)
  const name = deriveNameFromHead(head) || canonUrl.hostname
  const logoUrl = preferLogoUrl(head, canonUrl)
  const logoBase64 = logoUrl ? await fetchAsBase64(logoUrl) : null
  return { name, logoBase64, canonicalHost: canon }
}



