import { Injectable, Logger } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { Platform } from '../../schema/platform.entity'
import { fetchMetadata } from '../../lib/metadata-fetcher'
import { PlatformSearchService } from '../../lib/ai/platform-search.service'
import { R2StorageService } from '../../lib/r2-storage.service'

@Injectable()
export class PlatformsService {
  private readonly logger = new Logger(PlatformsService.name)

  constructor(
    @InjectRepository(Platform) private readonly repo: Repository<Platform>,
    private readonly platformSearchService: PlatformSearchService,
    private readonly r2: R2StorageService,
  ) {}

  async list() {
    return this.repo.find({ order: { name: 'ASC' } })
  }

  async upsert(name: string, url: string) {
    const { canonicalHost, logoBase64, name: derived } = await fetchMetadata(url)
    let platform = await this.repo.findOne({ where: { url: canonicalHost } })
    if (!platform) {
      platform = this.repo.create({ url: canonicalHost, name: name || derived || canonicalHost })
    } else if (name && platform.name !== name) {
      platform.name = name
    }
    // Always replace logo and overwrite in R2 when available
    if (logoBase64) {
      try {
        const host = new URL(canonicalHost).hostname
        const keyPrefix = `logos/platform/${host}/logo`
        platform.logo_url = await this.r2.uploadBase64Image(logoBase64, keyPrefix)
      } catch (e) {
        this.logger.warn(`Failed to upload platform logo to R2 for ${canonicalHost}: ${e}`)
      }
    }
    return this.repo.save(platform)
  }

  async searchAndUpsert(query: string): Promise<Platform[]> {
    // First try to find by name containing query for quick wins
    const existing = await this.repo
      .createQueryBuilder('p')
      .where('p.name ILIKE :q', { q: `%${query}%` })
      .orderBy('p.updated_at', 'DESC')
      .limit(20)
      .getMany()

    if (existing.length > 0) {
      this.logger.log(`Found ${existing.length} existing platforms for query: "${query}". Proceeding with AI search to refresh logos.`)
    }

    this.logger.log(`Searching with AI for "${query}" to ensure logos are refreshed...`)
    const results = await this.platformSearchService.searchPlatforms(query)
    if (!results || results.length === 0) return []

    const saved = await Promise.all(results.map((r) => this.upsertFromSearchResult(r)))
    this.logger.log(`Stored ${saved.length} platforms for query: "${query}"`)
    return saved
  }

  private async upsertFromSearchResult(result: { name: string; websiteUrl: string; logoBase64?: string | null }): Promise<Platform> {
    try {
      const { canonicalHost, name: derived, logoBase64: metaLogo } = await fetchMetadata(result.websiteUrl)

      let platform = await this.repo.findOne({ where: { url: canonicalHost } })
      if (!platform) {
        platform = this.repo.create({
          url: canonicalHost,
          name: result.name || derived || canonicalHost,
        })
        const base64 = result.logoBase64 ?? metaLogo ?? null
        if (base64) {
          try {
            const host = new URL(canonicalHost).hostname
            const keyPrefix = `logos/platform/${host}/logo`
            platform.logo_url = await this.r2.uploadBase64Image(base64, keyPrefix)
          } catch (e) {
            this.logger.warn(`Failed to upload platform logo to R2 for ${canonicalHost}: ${e}`)
          }
        }
      } else {
        const nextName = result.name || derived
        if (nextName && platform.name !== nextName) platform.name = nextName
        const nextLogo = result.logoBase64 ?? metaLogo ?? null
        if (nextLogo) {
          try {
            const host = new URL(canonicalHost).hostname
            const keyPrefix = `logos/platform/${host}/logo`
            platform.logo_url = await this.r2.uploadBase64Image(nextLogo, keyPrefix)
          } catch (e) {
            this.logger.warn(`Failed to upload updated platform logo to R2 for ${canonicalHost}: ${e}`)
          }
        }
      }

      return await this.repo.save(platform)
    } catch (error: any) {
      if (error?.code === '23505') {
        // Unique violation on url; return existing row
        const { canonicalHost } = await fetchMetadata(result.websiteUrl)
        const existing = await this.repo.findOne({ where: { url: canonicalHost } })
        if (existing) return existing
      }
      throw error
    }
  }
}


