import { Injectable, Logger } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { Platform } from '../../schema/platform.entity'
import { fetchMetadata } from '../../lib/metadata-fetcher'
import { PlatformSearchService } from '../../lib/ai/platform-search.service'

@Injectable()
export class PlatformsService {
  private readonly logger = new Logger(PlatformsService.name)

  constructor(
    @InjectRepository(Platform) private readonly repo: Repository<Platform>,
    private readonly platformSearchService: PlatformSearchService,
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
    // Always refresh logo when a new one is available
    if (logoBase64 && logoBase64 !== platform.logo_blob_base64) {
      platform.logo_blob_base64 = logoBase64
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
      this.logger.log(`Found ${existing.length} existing platforms for query: "${query}"`)
      return existing
    }

    this.logger.log(`No existing platforms found for "${query}". Using AI search...`)
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
          logo_blob_base64: result.logoBase64 ?? metaLogo ?? null,
        })
      } else {
        const nextName = result.name || derived
        if (nextName && platform.name !== nextName) platform.name = nextName
        const nextLogo = result.logoBase64 ?? metaLogo ?? null
        if (nextLogo && nextLogo !== platform.logo_blob_base64) platform.logo_blob_base64 = nextLogo
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


