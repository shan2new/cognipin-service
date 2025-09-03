import { Injectable, Logger, NotFoundException, Inject } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { In, Repository } from 'typeorm'
import { Company } from '../../schema/company.entity'
import { UserCompanyTarget } from '../../schema/user-company-target.entity'
import { CompanyGroup } from '../../schema/company-group.entity'
import { fetchMetadata } from '../../lib/metadata-fetcher'
import { CompanySearchService } from '../../lib/ai/company-search.service'
import { CompanySearchResult, LogoDownloader } from '../../lib/ai/interfaces'
import { R2StorageService } from '../../lib/r2-storage.service'

@Injectable()
export class CompaniesService {
  private readonly logger = new Logger(CompaniesService.name);

  constructor(
    @InjectRepository(Company) private readonly repo: Repository<Company>,
    @InjectRepository(UserCompanyTarget) private readonly targetRepo: Repository<UserCompanyTarget>,
    @InjectRepository(CompanyGroup) private readonly groupRepo: Repository<CompanyGroup>,
    private readonly companySearchService: CompanySearchService,
    private readonly r2: R2StorageService,
    @Inject('LOGO_DOWNLOADER') private readonly logoDownloader: LogoDownloader,
  ) {}

  async list(search?: string) {
    const qb = this.repo.createQueryBuilder('c')
    if (search) {
      qb.where('c.name ILIKE :q OR c.website_url ILIKE :q', { q: `%${search}%` })
    }
    qb.orderBy('c.updated_at', 'DESC').limit(50)
    return qb.getMany()
  }

  async upsertByWebsite(websiteUrl: string) {
    const { canonicalHost, name } = await fetchMetadata(websiteUrl)
    let company = await this.repo.findOne({ where: { website_url: canonicalHost } })
    if (!company) {
      company = this.repo.create({ website_url: canonicalHost, name: name || canonicalHost })
    } else if (name && !company.name) {
      company.name = name
    }
    // Always replace logo using the LogoDownloader and overwrite in R2 when available
    try {
      const host = (() => { try { return new URL(canonicalHost).hostname } catch { return canonicalHost.replace(/^https?:\/\//, '') } })()
      const downloaded = await this.logoDownloader.downloadLogo(host)
      if (downloaded) {
        const keyPrefix = `logos/company/${host}/logo`
        company.logo_url = await this.r2.uploadBase64Image(downloaded, keyPrefix)
      }
    } catch (e) {
      this.logger.warn(`Failed to replace logo for ${canonicalHost}: ${e}`)
    }
    return this.repo.save(company)
  }

  async getById(id: string) {
    const company = await this.repo.findOne({ where: { id } })
    if (!company) throw new NotFoundException('Company not found')
    return company
  }

  // === Targets & Groups (user scoped) ===
  async listAllForUser(userId: string, search?: string) {
    // All companies user has as targets plus companies present in user's applications
    // First, list target company ids
    const targets = await this.targetRepo.find({ where: { user_id: userId } })
    const targetCompanyIds = targets.map((t) => t.company_id)
    // Also find any companies from applications for this user
    // Use raw query to avoid circular deps; we assume application table exists
    const rows: Array<{ company_id: string }> = await (this.repo.manager.query(
      `SELECT DISTINCT company_id FROM application WHERE user_id = $1`,
      [userId],
    ) as any)
    const appCompanyIds = rows.map((r) => r.company_id)
    const allIds = Array.from(new Set([...targetCompanyIds, ...appCompanyIds]).values())
    if (allIds.length === 0) return []
    const qb = this.repo.createQueryBuilder('c').where('c.id IN (:...ids)', { ids: allIds })
    if (search) qb.andWhere('c.name ILIKE :q OR c.website_url ILIKE :q', { q: `%${search}%` })
    qb.orderBy('c.updated_at', 'DESC')
    return qb.getMany()
  }

  async listTargets(userId: string) {
    const targets = await this.targetRepo.find({ where: { user_id: userId } })
    const companyIds = targets.map((t) => t.company_id)
    const companies = companyIds.length ? await this.repo.findBy({ id: In(companyIds) }) : []
    const companyById = new Map(companies.map((c) => [c.id, c]))
    return targets.map((t) => ({ ...t, company: companyById.get(t.company_id) }))
  }

  async addTarget(userId: string, company_id: string, group_id?: string | null) {
    const existing = await this.targetRepo.findOne({ where: { user_id: userId, company_id } })
    if (existing) {
      if (group_id !== undefined) {
        existing.group_id = group_id || null
        return this.targetRepo.save(existing)
      }
      return existing
    }
    const target = this.targetRepo.create({ user_id: userId, company_id, group_id: group_id || null })
    return this.targetRepo.save(target)
  }

  async removeTarget(userId: string, id: string) {
    const row = await this.targetRepo.findOne({ where: { id } })
    if (!row || row.user_id !== userId) throw new NotFoundException('Target not found')
    await this.targetRepo.delete({ id })
    return { success: true }
  }

  async updateTargetGroup(userId: string, id: string, group_id: string | null) {
    const row = await this.targetRepo.findOne({ where: { id } })
    if (!row || row.user_id !== userId) throw new NotFoundException('Target not found')
    row.group_id = group_id
    return this.targetRepo.save(row)
  }

  async reorderTargets(userId: string, group_id: string, orderedIds: string[]) {
    // Simple reorder: set sort_order according to provided array
    const rows = await this.targetRepo.find({ where: { group_id } as any })
    const byId = new Map(rows.map(r => [r.id, r]))
    let order = 0
    for (const id of orderedIds) {
      const r = byId.get(id)
      if (r && r.user_id === userId) {
        r.sort_order = order++
        await this.targetRepo.save(r)
      }
    }
    return { success: true }
  }

  async listGroups(userId: string) {
    return this.groupRepo.find({ where: { user_id: userId }, order: { sort_order: 'ASC', created_at: 'ASC' as any } })
  }

  async createGroup(userId: string, name: string, sort_order?: number) {
    const g = this.groupRepo.create({ user_id: userId, name: name.trim(), sort_order: sort_order ?? 0 })
    return this.groupRepo.save(g)
  }

  async updateGroup(userId: string, id: string, body: { name?: string; sort_order?: number }) {
    const g = await this.groupRepo.findOne({ where: { id } })
    if (!g || g.user_id !== userId) throw new NotFoundException('Group not found')
    if (typeof body.name === 'string') g.name = body.name.trim()
    if (typeof body.sort_order === 'number') g.sort_order = body.sort_order
    return this.groupRepo.save(g)
  }

  async deleteGroup(userId: string, id: string) {
    const g = await this.groupRepo.findOne({ where: { id } })
    if (!g || g.user_id !== userId) throw new NotFoundException('Group not found')
    // Null out group_id for all targets referencing this group
    await this.targetRepo.createQueryBuilder()
      .update(UserCompanyTarget)
      .set({ group_id: null })
      .where('group_id = :id', { id })
      .execute()
    await this.groupRepo.delete({ id })
    return { success: true }
  }

  async searchAndUpsert(query: string): Promise<Company[]> {
    // Look up existing companies, but always proceed with AI search to refresh logos
    const existingCompanies = await this.findExistingCompanies(query);
    if (existingCompanies.length > 0) {
      this.logger.log(`Found ${existingCompanies.length} existing companies for query: "${query}". Refreshing via AI to replace logos.`);
    }

    this.logger.log(`Searching with AI for query: "${query}" to ensure logos are refreshed...`);
    const searchResults = await this.companySearchService.searchCompanies(query);
    
    if (!searchResults || searchResults.length === 0) {
      this.logger.log(`No companies found for query: "${query}"`);
      return [];
    }
    
    const companies = await Promise.all(
      searchResults.map(async (result) => {
        return this.upsertFromSearchResult(result);
      })
    );

    this.logger.log(`Stored ${companies.length} new companies for query: "${query}"`);
    return companies;
  }

  private async findExistingCompanies(query: string): Promise<Company[]> {
    const qb = this.repo.createQueryBuilder('c')
    qb.where('c.name ILIKE :q OR c.domain ILIKE :q', { q: `%${query}%` })
    qb.orderBy('c.updated_at', 'DESC').limit(20)
    return qb.getMany()
  }

  private sanitizeNumeric(value: any): number | null {
    if (value === undefined || value === null) return null
    if (typeof value === 'string') {
      if (value.toLowerCase() === 'unknown' || value.trim() === '') return null
      const parsed = parseFloat(value.replace(/[^0-9.-]/g, ''))
      return isFinite(parsed) ? parsed : null
    }
    if (typeof value === 'number') {
      return isFinite(value) ? value : null
    }
    return null
  }

  private sanitizeBoolean(value: any): boolean | null {
    if (value === undefined || value === null) return null
    if (typeof value === 'string') {
      const lower = value.toLowerCase().trim()
      if (lower === 'unknown' || lower === '') return null
      if (lower === 'true' || lower === 'yes' || lower === '1') return true
      if (lower === 'false' || lower === 'no' || lower === '0') return false
      return null
    }
    if (typeof value === 'boolean') {
      return value
    }
    if (typeof value === 'number') {
      return value === 1 ? true : value === 0 ? false : null
    }
    return null
  }

  private async upsertFromSearchResult(result: CompanySearchResult & { logoBase64?: string | null }): Promise<Company> {
    try {
      // Try to find existing company by website URL (case insensitive)
      let company = await this.repo.findOne({ 
        where: { website_url: result.websiteUrl.toLowerCase() } 
      });
      
      if (!company) {
        // Try alternative search by domain
        company = await this.repo.findOne({ 
          where: { domain: result.domain } 
        });
      }
      
      if (!company) {
        // Create new company
        company = this.repo.create({
          website_url: result.websiteUrl.toLowerCase(),
          name: result.name,
          domain: result.domain,
          date_of_incorporation: result.dateOfIncorporation,
          founded_year: result.foundedYear,
          description: result.description,
          industries: result.industries,
          hq: result.hq,
          employee_count: result.employeeCount,
          founders: result.founders,
          leadership: result.leadership,
          linkedin_url: result.linkedinUrl,
          crunchbase_url: result.crunchbaseUrl,
          traxcn_url: result.traxcnUrl,
          funding_total_usd: this.sanitizeNumeric(result.fundingTotalUSD),
          last_funding: result.lastFunding,
          is_public: this.sanitizeBoolean(result.isPublic),
          ticker: result.ticker,
          sources: result.sources,
          confidence: this.sanitizeNumeric(result.confidence),
        });
        if (result.logoBase64) {
          try {
            const host = (result.domain && result.domain.trim()) ? result.domain.trim() : new URL(result.websiteUrl).hostname
            const keyPrefix = `logos/company/${host}/logo`
            company.logo_url = await this.r2.uploadBase64Image(result.logoBase64, keyPrefix)
          } catch (e) {
            this.logger.warn(`Failed to upload company logo to R2 for ${result.websiteUrl}: ${e}`)
          }
        }
      } else {
        // Update existing company with new data if available
        if (result.name && result.name !== company.name) company.name = result.name;
        if (result.domain && result.domain !== company.domain) company.domain = result.domain;
        if (result.dateOfIncorporation && result.dateOfIncorporation !== company.date_of_incorporation) 
          company.date_of_incorporation = result.dateOfIncorporation;
        if (result.foundedYear && result.foundedYear !== company.founded_year) 
          company.founded_year = result.foundedYear;
        if (result.description && result.description !== company.description) 
          company.description = result.description;
        if (result.industries) company.industries = result.industries;
        if (result.hq) company.hq = result.hq;
        if (result.employeeCount && result.employeeCount !== company.employee_count) 
          company.employee_count = result.employeeCount;
        if (result.founders) company.founders = result.founders;
        if (result.leadership) company.leadership = result.leadership;
        if (result.linkedinUrl && result.linkedinUrl !== company.linkedin_url) 
          company.linkedin_url = result.linkedinUrl;
        if (result.crunchbaseUrl && result.crunchbaseUrl !== company.crunchbase_url) 
          company.crunchbase_url = result.crunchbaseUrl;
        if (result.traxcnUrl && result.traxcnUrl !== company.traxcn_url) 
          company.traxcn_url = result.traxcnUrl;
        // Sanitize numeric fields to prevent "Unknown" or invalid strings
        if (result.fundingTotalUSD !== undefined && result.fundingTotalUSD !== company.funding_total_usd) {
          const funding = this.sanitizeNumeric(result.fundingTotalUSD);
          if (funding !== null) company.funding_total_usd = funding;
        }
        if (result.lastFunding) company.last_funding = result.lastFunding;
        if (result.isPublic !== undefined && result.isPublic !== company.is_public) {
          const isPublic = this.sanitizeBoolean(result.isPublic);
          if (isPublic !== null) company.is_public = isPublic;
        }
        if (result.ticker && result.ticker !== company.ticker) company.ticker = result.ticker;
        if (result.sources) company.sources = result.sources;
        if (result.confidence !== undefined && result.confidence !== company.confidence) {
          const confidence = this.sanitizeNumeric(result.confidence);
          if (confidence !== null) company.confidence = confidence;
        }
        if (result.logoBase64) {
            try {
            const host = (result.domain && result.domain.trim()) ? result.domain.trim() : new URL(result.websiteUrl).hostname
            const keyPrefix = `logos/company/${host}/logo`
            company.logo_url = await this.r2.uploadBase64Image(result.logoBase64, keyPrefix)
          } catch (e) {
            this.logger.warn(`Failed to upload updated company logo to R2 for ${result.websiteUrl}: ${e}`)
          }
        }
      }

      return await this.repo.save(company);
    } catch (error: any) {
      // Handle duplicate key constraint violation
      if (error.code === '23505' && error.constraint === 'company_website_url_key') {
        this.logger.warn(`Duplicate website URL found: ${result.websiteUrl}, skipping...`);
        // Return the existing company
        const existingCompany = await this.repo.findOne({ where: { website_url: result.websiteUrl.toLowerCase() } }) || 
                               await this.repo.findOne({ where: { domain: result.domain } });
        if (!existingCompany) {
          throw new Error(`Failed to find existing company after duplicate key error`);
        }
        return existingCompany;
      }
      throw error;
    }
  }
}


