import 'reflect-metadata'
import { AppDataSource } from '../data-source'
import { Repository } from 'typeorm'
import { Company } from '../schema/company.entity'
import { Platform } from '../schema/platform.entity'
import { ConfigService } from '@nestjs/config'
import { R2StorageService } from '../lib/r2-storage.service'

/**
 * Backfill script to upload existing base64 logos from DB to Cloudflare R2 and set logo_url.
 *
 * Usage examples:
 *   ts-node src/scripts/backfill-logos-to-r2.ts --entity=company --limit=200
 *   ts-node src/scripts/backfill-logos-to-r2.ts --entity=platform --dry-run
 *   npm run backfill:logos -- --entity=both --limit=100
 */

function parseArgs() {
  const args = process.argv.slice(2)
  const out: Record<string, string | boolean | number> = {
    entity: 'both',
    limit: 0,
    dryRun: false,
  }
  for (let i = 0; i < args.length; i++) {
    const a = args[i]
    if (a === '--entity') out.entity = String(args[++i] || 'both')
    else if (a === '--limit') out.limit = Number(args[++i] || '0')
    else if (a === '--dry-run') out.dryRun = true
  }
  return out as { entity: 'company' | 'platform' | 'both'; limit: number; dryRun: boolean }
}

async function ensureConnected() {
  if (!AppDataSource.isInitialized) {
    await AppDataSource.initialize()
  }
}

async function backfillCompanies(r2: R2StorageService | null, limit = 0, dryRun = false) {
  const repo: Repository<Company> = AppDataSource.getRepository(Company)
  const qb = repo
    .createQueryBuilder('c')
    .orderBy('c.updated_at', 'DESC')
  if (limit && limit > 0) qb.limit(limit)
  const items = await qb.getMany()
  console.log(`Found ${items.length} companies to backfill`)

  let success = 0
  for (const c of items) {
    const host = (() => {
      try { return new URL(c.website_url).hostname } catch { return (c.domain || c.website_url).replace(/^https?:\/\//, '') }
    })()
    const keyPrefix = `logos/company/${host}/logo`
    try {
      if (dryRun) {
        console.log(`[DRY-RUN] Would upload company ${c.id} ${c.website_url}`)
        continue
      }
      // Skip - logo_blob_base64 column has been dropped, logos are now handled via R2 directly
      // success++ // Removed as this is unreachable due to continue
    } catch (e) {
      console.warn(`Failed to backfill company ${c.id} (${c.website_url}):`, e)
    }
  }
  console.log(`Backfilled ${success}/${items.length} companies`)
}

async function backfillPlatforms(r2: R2StorageService | null, limit = 0, dryRun = false) {
  const repo: Repository<Platform> = AppDataSource.getRepository(Platform)
  const qb = repo
    .createQueryBuilder('p')
    .orderBy('p.updated_at', 'DESC')
  if (limit && limit > 0) qb.limit(limit)
  const items = await qb.getMany()
  console.log(`Found ${items.length} platforms to backfill`)

  let success = 0
  for (const p of items) {
    const host = (() => {
      try { return new URL(p.url).hostname } catch { return p.url.replace(/^https?:\/\//, '') }
    })()
    const keyPrefix = `logos/platform/${host}/logo`
    try {
      if (dryRun) {
        console.log(`[DRY-RUN] Would upload platform ${p.id} ${p.url}`)
        continue
      }
      // Skip - logo_blob_base64 column has been dropped, logos are now handled via R2 directly
      // success++ // Removed as this is unreachable due to continue
    } catch (e) {
      console.warn(`Failed to backfill platform ${p.id} (${p.url}):`, e)
    }
  }
  console.log(`Backfilled ${success}/${items.length} platforms`)
}

async function main() {
  const { entity, limit, dryRun } = parseArgs()
  await ensureConnected()

  // R2 client using process.env (only if not dry run)
  const r2 = dryRun ? null : new R2StorageService(new ConfigService())

  if (entity === 'company' || entity === 'both') {
    await backfillCompanies(r2, limit, dryRun)
  }
  if (entity === 'platform' || entity === 'both') {
    await backfillPlatforms(r2, limit, dryRun)
  }

  await AppDataSource.destroy()
}

main().catch((e) => {
  console.error(e)
  process.exitCode = 1
})
