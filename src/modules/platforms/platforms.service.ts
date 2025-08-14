import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { Platform } from '../../schema/platform.entity'
import { fetchMetadata } from '../../lib/metadata-fetcher'

@Injectable()
export class PlatformsService {
  constructor(@InjectRepository(Platform) private readonly repo: Repository<Platform>) {}

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
    if (logoBase64 && !platform.logo_blob_base64) {
      platform.logo_blob_base64 = logoBase64
    }
    return this.repo.save(platform)
  }
}


