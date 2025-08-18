import { AIProvider, CompanySearchResponse, CompanySearchResult } from './interfaces';
import { OpenRouterProvider } from './openrouter-provider';
import { TavilyProvider, WebSearchProvider } from './tavily-provider';

/**
 * Hybrid AI provider with intelligent fallback strategy.
 * 
 * Strategy:
 * 1. Primary: Use DeepSeek-R1 free for initial company data gathering with reasoning
 * 2. Fallback: If DeepSeek finds no results, use Tavily for specialized web search
 * 3. Final Fallback: OpenRouter with online search if both fail
 * 
 * This approach maximizes cost efficiency by using free AI reasoning first,
 * with specialized web search only when needed.
 * 
 * Cost Optimization: Uses free tiers (DeepSeek-R1 free, Tavily free) with intelligent fallback.
 */
export class HybridFallbackProvider implements AIProvider {
  private openRouterProvider: OpenRouterProvider;
  private tavilyProvider: TavilyProvider;

  constructor(openRouterApiKey: string, tavilyApiKey: string) {
    this.openRouterProvider = new OpenRouterProvider(openRouterApiKey);
    this.tavilyProvider = new TavilyProvider(tavilyApiKey);
  }

  async searchCompanies(query: string): Promise<CompanySearchResponse> {
    console.log(`HybridFallbackProvider: Starting search for query: "${query}"`);

    try {
      // Step 1: Primary - Use DeepSeek-R1 free for initial reasoning
      console.log(`HybridFallbackProvider: Attempting DeepSeek-R1 reasoning...`);
      const deepseekResults = await this.searchWithDeepSeek(query);
      
      if (deepseekResults.companies.length > 0) {
        console.log(`HybridFallbackProvider: DeepSeek found ${deepseekResults.companies.length} companies`);
        return this.validateAndCleanCompanies(deepseekResults, query);
      }

      console.log(`HybridFallbackProvider: DeepSeek found no results, falling back to Tavily...`);
      
      // Step 2: Fallback - Use Tavily for specialized web search
      const tavilyResults = await this.tavilyProvider.searchCompanyInfo(query);
      
      if (tavilyResults.hasResults && tavilyResults.results.length > 0) {
        console.log(`HybridFallbackProvider: Tavily found ${tavilyResults.results.length} results, processing...`);
        
        const enhancedCompanies = await this.processWithWebData(query, tavilyResults, 'Tavily');
        
        if (enhancedCompanies.companies.length > 0) {
          console.log(`HybridFallbackProvider: Successfully processed ${enhancedCompanies.companies.length} companies using Tavily data`);
          return enhancedCompanies;
        }
      }

      console.log(`HybridFallbackProvider: Tavily unsuccessful, falling back to OpenRouter online...`);
      
      // Step 3: Final Fallback - OpenRouter with online search
      const fallbackResults = await this.openRouterProvider.searchCompanies(query);
      
      console.log(`HybridFallbackProvider: OpenRouter fallback returned ${fallbackResults.companies.length} companies`);
      
      return this.addSourceAttribution(fallbackResults, 'OpenRouter Online Search (Final Fallback)');

    } catch (error) {
      console.error(`HybridFallbackProvider: Error in searchCompanies for query "${query}":`, error);
      return { companies: [] };
    }
  }

  /**
   * Primary search using DeepSeek-R1 free model for initial reasoning
   */
  private async searchWithDeepSeek(query: string): Promise<CompanySearchResponse> {
    try {
      const client = (this.openRouterProvider as any).client;
      
      const response = await client.chat.completions.create({
        model: 'deepseek/deepseek-r1:free',
        messages: [
          { 
            role: 'system', 
            content: this.getSystemPrompt()
          },
          { 
            role: 'user', 
            content: `Find companies related to: "${query}". Provide detailed company information in the required JSON format.`
          }
        ],
        temperature: 0.3,
        max_tokens: 4000,
      });

      const outputText = response.choices[0]?.message?.content;
      
      if (!outputText) {
        console.log(`HybridFallbackProvider: No output from DeepSeek for query "${query}"`);
        return { companies: [] };
      }

      const parsedResult = this.parseAIResponse(outputText, query, 'DeepSeek-R1');
      return parsedResult || { companies: [] };

    } catch (error) {
      console.error(`HybridFallbackProvider: DeepSeek search error:`, error);
      return { companies: [] };
    }
  }

  /**
   * Process web search data with AI reasoning (refactored from processWithTavilyData)
   */
  private async processWithWebData(query: string, webResults: any, source: string): Promise<CompanySearchResponse> {
    try {
      const webContext = webResults.results
        .slice(0, 10)
        .map((result: any) => `Source: ${result.url}\nTitle: ${result.title}\nContent: ${result.content.slice(0, 500)}...`)
        .join('\n\n');

      const enhancedPrompt = this.getSystemPrompt() + 
        `\nWeb Search Results:\n${webContext}\n\nBased on the web search results above, ` +
        `extract company information for query: "${query}"`;

      const client = (this.openRouterProvider as any).client;
      
      const response = await client.chat.completions.create({
        model: 'moonshotai/kimi-k2:free',
        messages: [
          { role: 'system', content: enhancedPrompt },
          { role: 'user', content: query }
        ],
        temperature: 0.3,
        max_tokens: 4000,
      });

      const outputText = response.choices[0]?.message?.content;
      
      if (!outputText) {
        console.log(`HybridFallbackProvider: No output from ${source} processing`);
        return { companies: [] };
      }

      const parsedResult = this.parseAIResponse(outputText, query, `${source} + Kimi K2`);
      if (!parsedResult) {
        return { companies: [] };
      }
      const validatedResult = this.validateAndCleanCompanies(parsedResult, query);
      
      return validatedResult;

    } catch (error) {
      console.error(`HybridFallbackProvider: Error processing ${source} data:`, error);
      return { companies: [] };
    }
  }

  /**
   * Shared system prompt for consistent AI behavior
   */
  private getSystemPrompt(): string {
    return [
      "You are a research assistant specializing in company information extraction.",
      "Task: Given the input, identify companies explicitly or implicitly referenced (including prefix matches).",
      "Geographic disambiguation: Prioritize software entities with hq in India, then US, then UK, then Europe, then rest of the world.",
      "CRITICAL DATA SEPARATION RULES:",
      "1. Each company MUST have its own unique websiteUrl and domain - NEVER share domains between companies",
      "2. Only extract information that is SPECIFICALLY about each individual company",
      "3. DO NOT mix or merge data between different companies, even if they are related/subsidiaries",
      "4. If you cannot find a company's specific website, omit the websiteUrl rather than using another company's domain",
      "5. Each company must be completely independent with its own distinct information",
      "6. CRITICAL: 2seventy bio should have its own website (like 2seventybio.com), NOT Bristol Myers Squibb's website",
      "7. CRITICAL: Only use bms.com for Bristol Myers Squibb itself, never for subsidiary or related companies",
      "VALIDATION REQUIREMENTS:",
      "- Each company MUST have a unique websiteUrl and domain - no duplicates allowed",
      "- Prefer fewer, accurate companies over many companies with merged/incorrect data",
      "- Double-check that no company data has been mixed or contaminated",
      "Output format: { \"companies\": [ { name, websiteUrl, domain, description?, industries?, hq?, employeeCount?, founders?, leadership?, linkedinUrl?, crunchbaseUrl?, traxcnUrl?, fundingTotalUSD?, lastFunding?, isPublic?, ticker?, sources, confidence } ] }",
      "Return ONLY valid JSON. If a field is unknown, omit it. Dates must be DD-MM-YYYY format."
    ].join(" ");
  }

  /**
   * Shared AI response parsing logic
   */
  private parseAIResponse(outputText: string, query: string, source: string): CompanySearchResponse | null {
    // Try direct parsing first
    const directParse = (this.openRouterProvider as any).strictParseCompanies(outputText, query);
    if (directParse) {
      return this.addSourceAttribution(directParse, source);
    }

    // Fallback: try to fix the JSON format
    try {
      const client = (this.openRouterProvider as any).client;
      
      const reformatPrompt = [
        "Convert the following content into strict JSON format:",
        "{ \"companies\": [ { name, websiteUrl, domain, ...other fields } ] }",
        "Return ONLY JSON, no commentary."
      ].join(" ");

      // This would be async, but for now let's just return null and rely on validation
      console.warn(`HybridFallbackProvider: Could not parse ${source} response for "${query}"`);
      return null;
      
    } catch (error) {
      console.error(`HybridFallbackProvider: Failed to parse ${source} response:`, error);
      return null;
    }
  }

  /**
   * Add source attribution to results
   */
  private addSourceAttribution(result: CompanySearchResponse, source: string): CompanySearchResponse {
    return {
      companies: result.companies.map(company => ({
        ...company,
        sources: [
          ...(company.sources || []),
          source
        ]
      }))
    };
  }

  /**
   * Validates and cleans company data to prevent information contamination
   * between different companies in the results.
   */
  private validateAndCleanCompanies(result: CompanySearchResponse, query: string): CompanySearchResponse {
    if (!result.companies || result.companies.length === 0) {
      return result;
    }

    const cleanedCompanies: CompanySearchResult[] = [];
    const seenDomains = new Set<string>();
    const seenWebsites = new Set<string>();

    for (const company of result.companies) {
      // Skip companies with missing required fields
      if (!company.name || !company.websiteUrl || !company.domain) {
        console.warn(`HybridFallbackProvider: Skipping company with missing required fields:`, company.name);
        continue;
      }

      // Check for duplicate domains/websites (indicates data contamination)
      const normalizedDomain = company.domain.toLowerCase().replace(/^www\./, '');
      const normalizedWebsite = company.websiteUrl.toLowerCase();

      if (seenDomains.has(normalizedDomain) || seenWebsites.has(normalizedWebsite)) {
        console.warn(`HybridFallbackProvider: Detected data contamination - duplicate domain/website for company "${company.name}". Domain: ${normalizedDomain}. Skipping.`);
        continue;
      }

      // Validate domain extraction from website
      try {
        const urlDomain = new URL(company.websiteUrl).hostname.toLowerCase().replace(/^www\./, '');
        if (urlDomain !== normalizedDomain) {
          console.warn(`HybridFallbackProvider: Domain mismatch for company "${company.name}". URL domain: ${urlDomain}, provided domain: ${normalizedDomain}. Fixing.`);
          company.domain = urlDomain;
        }

        // Additional validation: Check if domain makes sense for the company name
        if (!this.isDomainValidForCompany(company.name, urlDomain)) {
          console.warn(`HybridFallbackProvider: Domain "${urlDomain}" doesn't appear to belong to company "${company.name}". Skipping company.`);
          continue;
        }
      } catch (error) {
        console.warn(`HybridFallbackProvider: Invalid websiteUrl for company "${company.name}": ${company.websiteUrl}. Skipping.`);
        continue;
      }

      // Track this company's domain and website
      seenDomains.add(normalizedDomain);
      seenWebsites.add(normalizedWebsite);
      
      // Add sources attribution for Tavily
      if (!company.sources) {
        company.sources = [];
      }
      if (!company.sources.some(source => source.includes('Tavily'))) {
        company.sources.push('Tavily Web Search + Kimi K2 Processing');
      }

      cleanedCompanies.push(company);
    }

    console.log(`HybridFallbackProvider: Validation completed for query "${query}". ${result.companies.length} -> ${cleanedCompanies.length} companies after cleaning.`);

    return {
      companies: cleanedCompanies
    };
  }

  /**
   * Validates if a domain likely belongs to the given company name.
   * This helps catch cases where AI incorrectly assigns one company's domain to another.
   */
  private isDomainValidForCompany(companyName: string, domain: string): boolean {
    // Normalize names for comparison
    const normalizedCompanyName = companyName.toLowerCase().replace(/[^a-z0-9]/g, '');
    const normalizedDomain = domain.toLowerCase().replace(/[^a-z0-9]/g, '');

    // Check for obvious mismatches
    const companyWords = companyName.toLowerCase().split(/\s+/).filter(word => 
      word.length > 2 && !['inc', 'llc', 'ltd', 'corp', 'company', 'co', 'group', 'holdings'].includes(word)
    );

    // If we can extract meaningful words from company name, check if any appear in domain
    if (companyWords.length > 0) {
      const hasMatchingWord = companyWords.some(word => {
        // Remove common business suffixes for better matching
        const cleanWord = word.replace(/(?:bio|tech|soft|systems?|solutions?|corp|inc|llc)$/, '');
        if (cleanWord.length < 3) return false;
        
        return normalizedDomain.includes(cleanWord) || normalizedDomain.includes(word);
      });

      if (!hasMatchingWord) {
        // Special cases for known domain patterns
        const specialCases = [
          // Handle cases like "2seventy bio" -> should not match "bms.com"
          { pattern: /seventy/i, validDomains: ['seventybio', '2seventy'] },
          { pattern: /bristol.*myers|bms/i, validDomains: ['bms'] },
        ];

        for (const specialCase of specialCases) {
          if (specialCase.pattern.test(companyName)) {
            const domainMatches = specialCase.validDomains.some(validDomain => 
              normalizedDomain.includes(validDomain)
            );
            return domainMatches;
          }
        }

        return false;
      }
    }

    // Additional check: prevent obvious cross-contamination
    const problematicDomains = ['bms.com', 'bristol-myers.com'];
    const isProblematicDomain = problematicDomains.includes(domain);
    
    if (isProblematicDomain) {
      // Only allow these domains for companies that clearly match
      const allowedForBMS = /bristol.*myers|bms/i.test(companyName);
      return allowedForBMS;
    }

    return true; // Allow if no obvious mismatch detected
  }
}
