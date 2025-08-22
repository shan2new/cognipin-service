import { Injectable, Logger, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { Company } from '../../schema/company.entity'
import { fetchMetadata } from '../../lib/metadata-fetcher'
import { CompanySearchService } from '../../lib/ai/company-search.service'
import { CompanySearchResult } from '../../lib/ai/interfaces'

@Injectable()
export class CompaniesService {
  private readonly logger = new Logger(CompaniesService.name);

  constructor(
    @InjectRepository(Company) private readonly repo: Repository<Company>,
    private readonly companySearchService: CompanySearchService,
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
    const company = await this.repo.findOne({ where: { id } })
    if (!company) throw new NotFoundException('Company not found')
    return company
  }

  async searchAndUpsert(query: string): Promise<Company[]> {
    // First, try to find existing companies in the database
    const existingCompanies = await this.findExistingCompanies(query);
    
    if (existingCompanies.length > 0) {
      this.logger.log(`Found ${existingCompanies.length} existing companies for query: "${query}"`);
      return existingCompanies;
    }

    // If no existing companies found, search using AI and store them
    this.logger.log(`No existing companies found for query: "${query}", searching with AI...`);
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
          funding_total_usd: result.fundingTotalUSD,
          last_funding: result.lastFunding,
          is_public: result.isPublic,
          ticker: result.ticker,
          sources: result.sources,
          confidence: result.confidence,
          logo_blob_base64: result.logoBase64,
        });
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
        if (result.fundingTotalUSD !== undefined && result.fundingTotalUSD !== company.funding_total_usd) 
          company.funding_total_usd = result.fundingTotalUSD;
        if (result.lastFunding) company.last_funding = result.lastFunding;
        if (result.isPublic !== undefined && result.isPublic !== company.is_public) 
          company.is_public = result.isPublic;
        if (result.ticker && result.ticker !== company.ticker) company.ticker = result.ticker;
        if (result.sources) company.sources = result.sources;
        if (result.confidence !== undefined && result.confidence !== company.confidence) 
          company.confidence = result.confidence;
        if (result.logoBase64 && result.logoBase64 !== company.logo_blob_base64) 
          company.logo_blob_base64 = result.logoBase64;
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


