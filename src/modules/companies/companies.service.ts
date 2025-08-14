import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { Company } from '../../schema/company.entity'
import { fetchMetadata } from '../../lib/metadata-fetcher'

@Injectable()
export class CompaniesService {
  constructor(@InjectRepository(Company) private readonly repo: Repository<Company>) {}

  async list(search?: string) {
    const qb = this.repo.createQueryBuilder('c')
    if (search) {
      qb.where('c.name ILIKE :q OR c.website_url ILIKE :q', { q: `%${search}%` })
    }
    qb.orderBy('c.updated_at', 'DESC').limit(50)
    return qb.getMany()
  }

  async upsertByWebsite(websiteUrl: string) {
    const { canonicalHost, name, logoBase64 } = await fetchMetadata(websiteUrl)
    let company = await this.repo.findOne({ where: { website_url: canonicalHost } })
    if (!company) {
      company = this.repo.create({ website_url: canonicalHost, name: name || canonicalHost })
    } else if (name && !company.name) {
      company.name = name
    }
    // Always refresh logo when a new one is available (keeps it lazily fresh)
    if (logoBase64 && logoBase64 !== company.logo_blob_base64) {
      company.logo_blob_base64 = logoBase64
    }
    return this.repo.save(company)
  }

  async getById(id: string) {
    return this.repo.findOneOrFail({ where: { id } })
  }
}


