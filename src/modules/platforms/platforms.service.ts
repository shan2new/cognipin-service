import { Injectable, Logger } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { Platform } from '../../schema/platform.entity'
import { UserPlatform } from '../../schema/user-platform.entity'
import { fetchMetadata } from '../../lib/metadata-fetcher'
import { PlatformSearchService } from '../../lib/ai/platform-search.service'
import { R2StorageService } from '../../lib/r2-storage.service'

@Injectable()
export class PlatformsService {
  private readonly logger = new Logger(PlatformsService.name)

  constructor(
    @InjectRepository(Platform) private readonly repo: Repository<Platform>,
    @InjectRepository(UserPlatform) private readonly userPlatformRepo: Repository<UserPlatform>,
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
      this.logger.log(`Found ${existing.length} existing platforms for query: "${query}". Returning existing results.`)
      return existing
    }

    this.logger.log(`No existing platforms found for "${query}". Searching with AI...`)
    const results = await this.platformSearchService.searchPlatforms(query)
    if (!results || results.length === 0) return []

    const saved = await Promise.all(results.map((r) => this.upsertFromSearchResult(r)))
    this.logger.log(`Stored ${saved.length} new platforms for query: "${query}"`)
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

  // --- User-platform mappings ---
  listUserPlatforms(userId: string) {
    return this.userPlatformRepo.find({ where: { user_id: userId }, relations: ['platform'], order: { updated_at: 'DESC' } })
  }

  async upsertUserPlatform(userId: string, platformId: string, rating: number | null, notes: string | null) {
    const existing = await this.userPlatformRepo.findOne({ where: { user_id: userId, platform_id: platformId } })
    if (existing) {
      existing.rating = typeof rating === 'number' ? Math.max(1, Math.min(5, Math.floor(rating))) : null
      existing.notes = notes ?? null
      const saved = await this.userPlatformRepo.save(existing)
      return this.userPlatformRepo.findOne({ where: { id: saved.id }, relations: ['platform'] })
    }
    const row = this.userPlatformRepo.create({ user_id: userId, platform_id: platformId, rating: typeof rating === 'number' ? Math.max(1, Math.min(5, Math.floor(rating))) : null, notes: notes ?? null })
    const saved = await this.userPlatformRepo.save(row)
    return this.userPlatformRepo.findOne({ where: { id: saved.id }, relations: ['platform'] })
  }

  async ensureUserPlatform(userId: string, platformId: string) {
    const existing = await this.userPlatformRepo.findOne({ where: { user_id: userId, platform_id: platformId } })
    if (existing) return existing
    const row = this.userPlatformRepo.create({ user_id: userId, platform_id: platformId, rating: null, notes: null })
    return this.userPlatformRepo.save(row)
  }

  async updateUserPlatform(userId: string, id: string, body: { rating?: number | null; notes?: string | null }) {
    const row = await this.userPlatformRepo.findOne({ where: { id, user_id: userId } })
    if (!row) throw new Error('Not found')
    if (Object.prototype.hasOwnProperty.call(body, 'rating')) {
      row.rating = typeof body.rating === 'number' ? Math.max(1, Math.min(5, Math.floor(body.rating))) : null
    }
    if (Object.prototype.hasOwnProperty.call(body, 'notes')) {
      row.notes = body.notes ?? null
    }
    const saved = await this.userPlatformRepo.save(row)
    return this.userPlatformRepo.findOne({ where: { id: saved.id }, relations: ['platform'] })
  }

  async deleteUserPlatform(userId: string, id: string) {
    const row = await this.userPlatformRepo.findOne({ where: { id, user_id: userId } })
    if (!row) throw new Error('Not found')
    await this.userPlatformRepo.delete({ id, user_id: userId })
    return { success: true }
  }
}


