import 'reflect-metadata'
import { AppDataSource } from '../data-source'
import { Repository } from 'typeorm'
import { Company } from '../schema/company.entity'
import { ConfigService } from '@nestjs/config'
import { OpenRouterProvider } from '../lib/ai/openrouter-provider'
import { R2StorageService } from '../lib/r2-storage.service'
import { fetchMetadata } from '../lib/metadata-fetcher'
import { ClearbitLogoDownloader } from '../lib/ai/logo-downloader'

type Args = {
  limit: number
  dryRun: boolean
  onlyMissingLogo: boolean
  confirm: boolean
}

function parseArgs(): Args {
  const args = process.argv.slice(2)
  const out: Args = {
    limit: 0,
    dryRun: false,
    onlyMissingLogo: false,
    confirm: false,
  }
  for (let i = 0; i < args.length; i++) {
    const a = args[i]
    if (a === '--limit') out.limit = Number(args[++i] || '0')
    else if (a === '--dry-run') out.dryRun = true
    else if (a === '--only-missing-logo') out.onlyMissingLogo = true
    else if (a === '--yes' || a === '--confirm') out.confirm = true
  }
  return out
}

async function ensureConnected() {
  if (!AppDataSource.isInitialized) {
    await AppDataSource.initialize()
  }
}

function normalizeHost(raw: string): string {
  try {
    const u = new URL(raw)
    return `${u.protocol}//${u.host.replace(/^www\./i, '')}`.toLowerCase()
  } catch {
    // Try adding https:// if missing
    try {
      const u2 = new URL(`https://${raw.replace(/^https?:\/\//, '')}`)
      return `${u2.protocol}//${u2.host.replace(/^www\./i, '')}`.toLowerCase()
    } catch {
      return raw.toLowerCase()
    }
  }
}

function hostFromUrl(raw: string): string {
  try { return new URL(raw).hostname } catch { return raw.replace(/^https?:\/\//, '') }
}

async function validateCompanyNameWithOnlineLlama(ai: OpenRouterProvider, websiteUrl: string): Promise<string | null> {
  const host = hostFromUrl(websiteUrl)
  const query = `Identify the official company for domain ${host}. Return JSON with companies including name, websiteUrl, and domain.`
  const res = await ai.searchCompanies(query)
  const normalizedHost = host.replace(/^www\./i, '')
  const match = (res.companies || []).find((c: any) => (c.domain || '').replace(/^www\./i, '') === normalizedHost)
  if (match && match.name) return String(match.name).trim() || null
  const first = (res.companies || [])[0]
  return first?.name ? String(first.name).trim() : null
}

async function populateLogoIfMissing(
  r2: R2StorageService | null,
  logoDownloader: ClearbitLogoDownloader,
  company: Company,
  canonicalHost: string,
  dryRun: boolean,
): Promise<string | null> {
  if (company.logo_url) return company.logo_url
  const host = hostFromUrl(canonicalHost)

  // Try Clearbit first (fast, good defaults)
  try {
    const base64 = await logoDownloader.downloadLogo(host)
    if (base64) {
      if (dryRun || !r2) return `(dry-run) logos/company/${host}/logo`
      const keyPrefix = `logos/company/${host}/logo`
      return await r2.uploadBase64Image(base64, keyPrefix)
    }
  } catch {}

  // Fallback to metadata-derived favicon/og:image
  try {
    const meta = await fetchMetadata(canonicalHost)
    if (meta.logoBase64) {
      if (dryRun || !r2) return `(dry-run) logos/company/${host}/logo`
      const keyPrefix = `logos/company/${host}/logo`
      return await r2.uploadBase64Image(meta.logoBase64, keyPrefix)
    }
  } catch {}

  return null
}

async function processCompanies(args: Args) {
  const repo: Repository<Company> = AppDataSource.getRepository(Company)
  const qb = repo.createQueryBuilder('c')
  if (args.onlyMissingLogo) qb.where('c.logo_url IS NULL')
  qb.orderBy('c.updated_at', 'DESC')
  if (args.limit && args.limit > 0) qb.limit(args.limit)
  const companies = await qb.getMany()
  console.log(`Found ${companies.length} companies to process`)

  const config = new ConfigService()
  const openRouterKey = config.get<string>('OPENROUTER_API_KEY') || ''
  const ai = openRouterKey ? new OpenRouterProvider(openRouterKey) : null
  const r2 = args.dryRun ? null : new R2StorageService(config)
  const logoDownloader = new ClearbitLogoDownloader()

  let updated = 0
  for (const company of companies) {
    const canon = normalizeHost(company.website_url)
    const host = hostFromUrl(canon)
    let changed = false

    // 1) Validate/fix name using metadata, then Tavily as fallback
    try {
      const meta = await fetchMetadata(canon)
      if (meta.name && meta.name.trim() && meta.name.trim() !== company.name) {
        console.log(`Name update from metadata: ${company.name} -> ${meta.name} (${host})`)
        company.name = meta.name.trim()
        changed = true
      }
    } catch {}

    if (ai) {
      try {
        const onlineName = await validateCompanyNameWithOnlineLlama(ai, canon)
        if (onlineName && onlineName !== company.name) {
          console.log(`Name update from Llama Online: ${company.name} -> ${onlineName} (${host})`)
          company.name = onlineName
          changed = true
        }
      } catch {}
    }

    // 2) Populate missing logo via Clearbit → metadata
    if (!company.logo_url) {
      const logoUrl = await populateLogoIfMissing(r2, logoDownloader, company, canon, args.dryRun)
      if (logoUrl) {
        company.logo_url = logoUrl
        changed = true
      }
    }

    if (changed) {
      if (args.dryRun) {
        console.log(`[DRY-RUN] Would save updates for ${company.id} ${canon}`)
      } else {
        await repo.save(company)
        updated++
      }
    }
  }

  console.log(`Updated ${updated}/${companies.length} companies`)
}

async function main() {
  const args = parseArgs()
  if (!args.confirm && !args.dryRun) {
    console.error('Refusing to run without --yes (or use --dry-run).')
    process.exitCode = 1
    return
  }
  await ensureConnected()
  try {
    await processCompanies(args)
  } finally {
    await AppDataSource.destroy()
  }
}

main().catch((e) => {
  console.error(e)
  process.exitCode = 1
})


