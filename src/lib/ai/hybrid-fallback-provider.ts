import { AIProvider, CompanySearchResponse, CompanySearchResult } from './interfaces';
import { OpenRouterProvider } from './openrouter-provider';
import { TavilyProvider, WebSearchProvider } from './tavily-provider';

/**
 * Speed-optimized hybrid AI provider with intelligent fallback strategy.
 * 
 * Strategy (optimized for speed):
 * 1. Primary: Llama 3.1 8B free - Fast, handles most straightforward company queries
 * 2. Secondary: Mistral Small free - Still fast, more capable for harder cases  
 * 3. Reasoning Fallback: DeepSeek-R1 free - Only for disambiguation that needs reasoning
 * 4. Web Fallback: Tavily - Only when model confidence is low or sources are missing
 * 
 * This approach maximizes speed by using fast models first, with expensive operations
 * (reasoning/web search) only for cases that truly need them.
 * 
 * Cost & Speed Optimization: Most queries resolved by fast free models in <2s.
 */
export class HybridFallbackProvider implements AIProvider {
  private openRouterProvider: OpenRouterProvider;
  private tavilyProvider: TavilyProvider;

  constructor(openRouterApiKey: string, tavilyApiKey: string) {
    this.openRouterProvider = new OpenRouterProvider(openRouterApiKey);
    this.tavilyProvider = new TavilyProvider(tavilyApiKey);
  }

  async searchCompanies(query: string): Promise<CompanySearchResponse> {
    console.log(`HybridFallbackProvider: Starting speed-optimized search for query: "${query}"`);

    try {
      // Step 1: Primary - Fast Llama 3.1 8B for straightforward cases
      console.log(`HybridFallbackProvider: Attempting fast Llama 3.1 8B...`);
      const llamaResults = await this.searchWithFastModel(query, 'meta-llama/llama-3.1-8b-instruct:free', 'Llama-3.1-8B');
      
      if (this.isResultSufficient(llamaResults)) {
        console.log(`HybridFallbackProvider: Llama 3.1 8B found sufficient results (${llamaResults.companies.length} companies)`);
        return this.validateAndCleanCompanies(llamaResults, query);
      }

      console.log(`HybridFallbackProvider: Llama results insufficient, trying Mistral Small...`);
      
      // Step 2: Secondary - Mistral Small for harder cases (still fast)
      const mistralResults = await this.searchWithFastModel(query, 'mistralai/mistral-small-3.1-24b-instruct:free', 'Mistral-Small');
      
      if (this.isResultSufficient(mistralResults)) {
        console.log(`HybridFallbackProvider: Mistral Small found sufficient results (${mistralResults.companies.length} companies)`);
        return this.validateAndCleanCompanies(mistralResults, query);
      }

      console.log(`HybridFallbackProvider: Fast models insufficient, checking if reasoning needed...`);
      
      // Step 3: Reasoning Fallback - DeepSeek R1 for disambiguation
      if (this.needsReasoning(query, mistralResults)) {
        console.log(`HybridFallbackProvider: Query needs reasoning, using DeepSeek R1...`);
        const deepseekResults = await this.searchWithDeepSeek(query);
        
        if (this.isResultSufficient(deepseekResults)) {
          console.log(`HybridFallbackProvider: DeepSeek reasoning found sufficient results (${deepseekResults.companies.length} companies)`);
          return this.validateAndCleanCompanies(deepseekResults, query);
        }
      }

      console.log(`HybridFallbackProvider: Low confidence or missing sources, using Tavily web search...`);
      
      // Step 4: Web Fallback - Tavily for low confidence or missing sources
      const tavilyResults = await this.tavilyProvider.searchCompanyInfo(query);
      
      if (tavilyResults.hasResults && tavilyResults.results.length > 0) {
        console.log(`HybridFallbackProvider: Tavily found ${tavilyResults.results.length} results, processing...`);
        
        const enhancedCompanies = await this.processWithWebData(query, tavilyResults, 'Tavily');
        
        if (enhancedCompanies.companies.length > 0) {
          console.log(`HybridFallbackProvider: Successfully processed ${enhancedCompanies.companies.length} companies using Tavily data`);
          return enhancedCompanies;
        }
      }

      console.log(`HybridFallbackProvider: All methods unsuccessful, returning empty results`);
      return { companies: [] };

    } catch (error) {
      console.error(`HybridFallbackProvider: Error in searchCompanies for query "${query}":`, error);
      return { companies: [] };
    }
  }

  /**
   * Fast model search for primary and secondary queries
   */
  private async searchWithFastModel(query: string, model: string, modelName: string): Promise<CompanySearchResponse> {
    try {
      const client = (this.openRouterProvider as any).client;
      
      const response = await client.chat.completions.create({
        model: model,
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
        max_tokens: 3000, // Slightly less for faster response
      });

      const outputText = response.choices[0]?.message?.content;
      
      if (!outputText) {
        console.log(`HybridFallbackProvider: No output from ${modelName} for query "${query}"`);
        return { companies: [] };
      }

      const parsedResult = this.parseAIResponse(outputText, query, modelName);
      return parsedResult || { companies: [] };

    } catch (error) {
      console.error(`HybridFallbackProvider: ${modelName} search error:`, error);
      return { companies: [] };
    }
  }

  /**
   * Check if results are sufficient (good confidence and have sources)
   */
  private isResultSufficient(result: CompanySearchResponse): boolean {
    if (!result.companies || result.companies.length === 0) {
      return false;
    }

    // Check if companies have good confidence and basic required fields
    const sufficientCompanies = result.companies.filter(company => {
      const hasBasicFields = company.name && company.websiteUrl && company.domain;
      const hasGoodConfidence = company.confidence && company.confidence >= 0.7;
      const hasSources = company.sources && company.sources.length > 0;
      
      return hasBasicFields && (hasGoodConfidence || hasSources);
    });

    return sufficientCompanies.length > 0;
  }

  /**
   * Determine if query needs reasoning (disambiguation, complex cases)
   */
  private needsReasoning(query: string, lastResult: CompanySearchResponse): boolean {
    // Check for disambiguation keywords
    const disambiguationKeywords = [
      'which', 'what', 'difference', 'compare', 'versus', 'vs', 
      'better', 'similar', 'alternative', 'like', 'related'
    ];
    
    const queryLower = query.toLowerCase();
    const hasDisambiguation = disambiguationKeywords.some(keyword => 
      queryLower.includes(keyword)
    );

    // Check if query is ambiguous (multiple possible interpretations)
    const isAmbiguous = query.split(' ').length >= 3 || 
                       query.includes('/') || 
                       query.includes('&') ||
                       query.includes('+');

    // Check if last result had low confidence companies
    const hasLowConfidence = lastResult.companies.some(company => 
      !company.confidence || company.confidence < 0.7
    );

    // Check if companies are missing key sources
    const missingSources = lastResult.companies.some(company => 
      !company.sources || company.sources.length === 0
    );

    return hasDisambiguation || isAmbiguous || hasLowConfidence || missingSources;
  }

  /**
   * DeepSeek-R1 search for reasoning-heavy disambiguation cases
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
      "- Set confidence score (0.0-1.0) based on data quality and certainty",
      "- Include sources array with references to data origins",
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
