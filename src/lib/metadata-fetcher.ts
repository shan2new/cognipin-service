import { setTimeout as delay } from 'node:timers/promises'

export type FetchedMeta = {
  name: string | null
  logoBase64: string | null
  logoUrl: string | null
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
  // Split by any of the separators: | or dashes (-, –, —), choose the shortest segment
  const parts = title
    .split(/\s*(?:\||[\-–—])\s*/)
    .map((p) => cleanSegment(p))
    .filter(Boolean)

  if (parts.length > 1) {
    let shortest = parts[0]
    for (let i = 1; i < parts.length; i++) {
      if (parts[i].length < shortest.length) shortest = parts[i]
    }
    return shortest
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
  // Prefer: link[rel*="icon"]
  const linkTags = headHtml.match(/<link[^>]*>/gi) || []
  for (const tag of linkTags) {
    if (/rel=["'][^"']*icon[^"']*["']/i.test(tag)) {
      const hrefMatch = tag.match(/href=["']([^"']+)["']/i)
      if (hrefMatch && hrefMatch[1]) {
        const cleaned = sanitizeUrl(hrefMatch[1], base)
        if (cleaned) return cleaned
      }
    }
  }

  // Fallback to og:image if provided
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
  return { name, logoBase64, logoUrl, canonicalHost: canon }
}



