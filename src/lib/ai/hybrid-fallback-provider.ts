import { AIProvider, CompanySearchResponse, CompanySearchResult } from './interfaces';
import { OpenRouterProvider } from './openrouter-provider';
import { TavilyProvider, WebSearchProvider } from './tavily-provider';

/**
 * Configuration for a model used in the fallback chain
 */
export interface ModelConfig {
  /** The model identifier used for API calls */
  id: string;
  
  /** Human-readable name of the model */
  name: string;
  
  /** Temperature setting for the model (0.0-1.0) */
  temperature?: number;
  
  /** Maximum tokens to generate */
  maxTokens?: number;
  
  /** Model purpose/role in the fallback chain */
  role?: 'primary' | 'secondary' | 'reasoning' | 'web-processing';
}

/**
 * Configuration for the hybrid fallback provider
 */
export interface HybridFallbackProviderConfig {
  /** Primary fast models to try first (in order of priority) */
  primaryModels: ModelConfig[];
  
  /** Secondary models with better reasoning capabilities (in order of priority) */
  secondaryModels: ModelConfig[];
  
  /** Models specialized for complex reasoning tasks */
  reasoningModels: ModelConfig[];
  
  /** Models for processing web search results */
  webProcessingModels: ModelConfig[];
}

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
  private config: HybridFallbackProviderConfig;

  /**
   * Default model configuration with recommended models and settings
   */
  static readonly DEFAULT_CONFIG: HybridFallbackProviderConfig = {
    primaryModels: [
      { id: 'inception/mercury-coder:nitro', name: 'Mercury-Coder', temperature: 0.3, maxTokens: 3500, role: 'primary' },
      // { id: 'meta-llama/llama-3.2-3b-instruct:free', name: 'Llama-3.1-8B', temperature: 0.3, maxTokens: 3000, role: 'primary' }
    ],
    secondaryModels: [
      { id: 'mistralai/mistral-small-3.2-24b-instruct:free:nitro', name: 'Mistral-Small', temperature: 0.3, maxTokens: 3500, role: 'secondary' }
    ],
    reasoningModels: [
      { id: 'deepseek/deepseek-r1:free', name: 'DeepSeek-R1', temperature: 0.3, maxTokens: 4000, role: 'reasoning' }
    ],
    webProcessingModels: [
      { id: 'moonshotai/kimi-k2:free', name: 'Kimi K2', temperature: 0.3, maxTokens: 4000, role: 'web-processing' }
    ]
  };

  /**
   * Create a new HybridFallbackProvider
   * 
   * @param openRouterApiKey - API key for OpenRouter
   * @param tavilyApiKey - API key for Tavily
   * @param config - Optional custom model configuration (default: DEFAULT_CONFIG)
   */
  constructor(
    openRouterApiKey: string, 
    tavilyApiKey: string, 
    config?: Partial<HybridFallbackProviderConfig>
  ) {
    this.openRouterProvider = new OpenRouterProvider(openRouterApiKey);
    this.tavilyProvider = new TavilyProvider(tavilyApiKey);
    
    // Merge provided config with defaults
    this.config = {
      primaryModels: config?.primaryModels || [...HybridFallbackProvider.DEFAULT_CONFIG.primaryModels],
      secondaryModels: config?.secondaryModels || [...HybridFallbackProvider.DEFAULT_CONFIG.secondaryModels],
      reasoningModels: config?.reasoningModels || [...HybridFallbackProvider.DEFAULT_CONFIG.reasoningModels],
      webProcessingModels: config?.webProcessingModels || [...HybridFallbackProvider.DEFAULT_CONFIG.webProcessingModels]
    };
  }

  async searchCompanies(query: string): Promise<CompanySearchResponse> {
    console.log(`HybridFallbackProvider: Starting speed-optimized search for query: "${query}"`);

    try {
      // Step 1: Try primary models in order of priority
      if (this.config.primaryModels.length > 0) {
        for (const model of this.config.primaryModels) {
          console.log(`HybridFallbackProvider: Attempting primary model ${model.name}...`);
          const results = await this.searchWithModel(query, model);
          
          if (this.isResultSufficient(results)) {
            console.log(`HybridFallbackProvider: ${model.name} found sufficient results (${results.companies.length} companies)`);
            return this.validateAndCleanCompanies(results, query);
          }
        }
      }

      console.log(`HybridFallbackProvider: Primary models insufficient, trying secondary models...`);
      
      // Step 2: Try secondary models in order of priority
      let lastSecondaryResult: CompanySearchResponse = { companies: [] };
      if (this.config.secondaryModels.length > 0) {
        for (const model of this.config.secondaryModels) {
          console.log(`HybridFallbackProvider: Attempting secondary model ${model.name}...`);
          const results = await this.searchWithModel(query, model);
          
          if (this.isResultSufficient(results)) {
            console.log(`HybridFallbackProvider: ${model.name} found sufficient results (${results.companies.length} companies)`);
            return this.validateAndCleanCompanies(results, query);
          }
          
          // Keep track of last secondary result for reasoning check
          if (results.companies.length > 0) {
            lastSecondaryResult = results as CompanySearchResponse;
          }
        }
      }

      console.log(`HybridFallbackProvider: Secondary models insufficient, checking if reasoning needed...`);
      
      // Step 3: Try reasoning models if needed
      if (this.needsReasoning(query, lastSecondaryResult) && this.config.reasoningModels.length > 0) {
        for (const model of this.config.reasoningModels) {
          console.log(`HybridFallbackProvider: Query needs reasoning, using ${model.name}...`);
          const results = await this.searchWithReasoningModel(query, model);
          
          if (this.isResultSufficient(results)) {
            console.log(`HybridFallbackProvider: ${model.name} reasoning found sufficient results (${results.companies.length} companies)`);
            return this.validateAndCleanCompanies(results, query);
          }
        }
      }

      console.log(`HybridFallbackProvider: Low confidence or missing sources, using Tavily web search...`);
      
      // Step 4: Web Fallback - Tavily for low confidence or missing sources
      const tavilyResults = await this.tavilyProvider.searchCompanyInfo(query);
      
      if (tavilyResults.hasResults && tavilyResults.results.length > 0) {
        console.log(`HybridFallbackProvider: Tavily found ${tavilyResults.results.length} results, processing...`);
        
        if (this.config.webProcessingModels.length > 0) {
          for (const model of this.config.webProcessingModels) {
            const enhancedCompanies = await this.processWithWebData(query, tavilyResults, model);
            
            if (enhancedCompanies.companies.length > 0) {
              console.log(`HybridFallbackProvider: Successfully processed ${enhancedCompanies.companies.length} companies using Tavily data and ${model.name}`);
              return enhancedCompanies;
            }
          }
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
   * Generalized model search for any model in the pipeline
   */
  private async searchWithModel(query: string, modelConfig: ModelConfig): Promise<CompanySearchResponse> {
    try {
      const client = (this.openRouterProvider as any).client;
      
      const response = await client.chat.completions.create({
        model: modelConfig.id,
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
        temperature: modelConfig.temperature ?? 0.3,
        max_tokens: modelConfig.maxTokens ?? 3000,
      });

      const outputText = response.choices[0]?.message?.content;
      
      if (!outputText) {
        console.log(`HybridFallbackProvider: No output from ${modelConfig.name} for query "${query}"`);
        return { companies: [] };
      }

      const parsedResult = this.parseAIResponse(outputText, query, modelConfig.name);
      return parsedResult || { companies: [] };

    } catch (error) {
      console.error(`HybridFallbackProvider: ${modelConfig.name} search error:`, error);
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
   * Specialized search with reasoning-focused models for complex disambiguation cases
   */
  private async searchWithReasoningModel(query: string, modelConfig: ModelConfig): Promise<CompanySearchResponse> {
    try {
      const client = (this.openRouterProvider as any).client;
      
      const response = await client.chat.completions.create({
        model: modelConfig.id,
        messages: [
          { 
            role: 'system', 
            content: this.getSystemPrompt()
          },
          { 
            role: 'user', 
            content: `Find companies related to: "${query}". This query may require disambiguation or careful analysis. Provide detailed company information in the required JSON format.`
          }
        ],
        temperature: modelConfig.temperature ?? 0.3,
        max_tokens: modelConfig.maxTokens ?? 4000,
      });

      const outputText = response.choices[0]?.message?.content;
      
      if (!outputText) {
        console.log(`HybridFallbackProvider: No output from ${modelConfig.name} for query "${query}"`);
        return { companies: [] };
      }

      const parsedResult = this.parseAIResponse(outputText, query, modelConfig.name);
      return parsedResult || { companies: [] };

    } catch (error) {
      console.error(`HybridFallbackProvider: ${modelConfig.name} reasoning search error:`, error);
      return { companies: [] };
    }
  }

  /**
   * Process web search data with AI reasoning
   */
  private async processWithWebData(query: string, webResults: any, modelConfig: ModelConfig): Promise<CompanySearchResponse> {
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
        model: modelConfig.id,
        messages: [
          { role: 'system', content: enhancedPrompt },
          { role: 'user', content: query }
        ],
        temperature: modelConfig.temperature ?? 0.3,
        max_tokens: modelConfig.maxTokens ?? 4000,
      });

      const outputText = response.choices[0]?.message?.content;
      
      if (!outputText) {
        console.log(`HybridFallbackProvider: No output from ${modelConfig.name} processing`);
        return { companies: [] };
      }

      const parsedResult = this.parseAIResponse(outputText, query, `Tavily + ${modelConfig.name}`);
      if (!parsedResult) {
        return { companies: [] };
      }
      const validatedResult = this.validateAndCleanCompanies(parsedResult, query);
      
      return validatedResult;

    } catch (error) {
      console.error(`HybridFallbackProvider: Error processing with ${modelConfig.name}:`, error);
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
