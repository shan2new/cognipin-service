import { AIProvider, CompanySearchResponse, CompanySearchResult } from './interfaces';
import { OpenRouterProvider } from './openrouter-provider';
import { TavilyProvider, WebSearchProvider } from './tavily-provider';

/**
 * Hybrid AI provider that combines Tavily web search with OpenRouter fallback.
 * 
 * Strategy:
 * 1. First attempt: Use Tavily for specialized web search of company information
 * 2. Fallback: If Tavily returns no meaningful results, use OpenRouter with online search
 * 
 * This approach maximizes search quality by leveraging Tavily's specialized business search
 * while ensuring reliability through OpenRouter's integrated online capabilities.
 * 
 * Cost Optimization: Uses Kimi K2 free tier for data processing, ensuring no charges
 * while maintaining high-quality company data extraction and structuring.
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
      // Step 1: Try Tavily first for specialized business search
      console.log(`HybridFallbackProvider: Attempting Tavily search...`);
      const tavilyResults = await this.tavilyProvider.searchCompanyInfo(query);
      
      if (tavilyResults.hasResults && tavilyResults.results.length > 0) {
        console.log(`HybridFallbackProvider: Tavily found ${tavilyResults.results.length} results, processing with OpenRouter...`);
        
        // Use Tavily results to enhance OpenRouter's response
        const enhancedCompanies = await this.processWithTavilyData(query, tavilyResults);
        
        if (enhancedCompanies.companies.length > 0) {
          console.log(`HybridFallbackProvider: Successfully processed ${enhancedCompanies.companies.length} companies using Tavily data`);
          return enhancedCompanies;
        }
      }

      console.log(`HybridFallbackProvider: Tavily search unsuccessful, falling back to OpenRouter online...`);
      
      // Step 2: Fallback to OpenRouter with online search
      const fallbackResults = await this.openRouterProvider.searchCompanies(query);
      
      console.log(`HybridFallbackProvider: OpenRouter fallback returned ${fallbackResults.companies.length} companies`);
      
      // Mark results as fallback
      const markedResults = {
        companies: fallbackResults.companies.map(company => ({
          ...company,
          sources: [
            ...(company.sources || []),
            'OpenRouter Online Search (Fallback)'
          ]
        }))
      };

      return markedResults;

    } catch (error) {
      console.error(`HybridFallbackProvider: Error in searchCompanies for query "${query}":`, error);
      
      // Final fallback: try OpenRouter without online search
      try {
        console.log(`HybridFallbackProvider: Attempting final fallback to OpenRouter without online search...`);
        return await this.openRouterProvider.searchCompanies(query);
      } catch (fallbackError) {
        console.error(`HybridFallbackProvider: All fallbacks failed:`, fallbackError);
        return { companies: [] };
      }
    }
  }

  private async processWithTavilyData(query: string, tavilyResults: any): Promise<CompanySearchResponse> {
    // Create an enhanced prompt that includes Tavily search results
    const webContext = tavilyResults.results
      .slice(0, 10) // Limit to top 10 results
      .map((result: any) => `Source: ${result.url}\nTitle: ${result.title}\nContent: ${result.content.slice(0, 500)}...`)
      .join('\n\n');

    const enhancedPrompt = [
      "You are a research assistant with access to web search results about companies.",
      "Task: Given the input string and web search results, identify companies explicitly or implicitly referenced (including prefix matches).",
      "Geographic disambiguation: Only software entities with hq first in India, then US, then UK, then Europe, then rest of the world. In that order.",
      "CRITICAL DATA SEPARATION RULES:",
      "1. Each company MUST have its own unique websiteUrl and domain - NEVER share domains between companies",
      "2. Only extract information that is SPECIFICALLY about each individual company",
      "3. DO NOT mix or merge data between different companies, even if they are related/subsidiaries",
      "4. If you cannot find a company's specific website, omit the websiteUrl rather than using another company's domain",
      "5. Each company must be completely independent with its own distinct information",
      "IMPORTANT: Use the provided web search results to extract accurate company information. Do NOT return a logo image URL. Instead, return each company's own OFFICIAL website URL and its unique domain.",
      "Web Search Results:",
      webContext,
      "",
      "For each company, extract the following fields based ONLY on information specifically about that company:",
      "- name (string)",
      "- websiteUrl (string; official site, HTTPS preferred)",
      "- domain (string; extracted from websiteUrl)",
      "- dateOfIncorporation (string; DD-MM-YYYY)",
      "- foundedYear (string; YYYY; optional)",
      "- description (string; 1-2 line summary; optional)",
      "- industries (array of strings; optional)",
      "- hq (object with optional city, country)",
      "- employeeCount (string; optional)",
      "- founders (array of objects with name and optional role; optional)",
      "- leadership (array of objects with name and title; optional)",
      "- linkedinUrl (string; optional)",
      "- crunchbaseUrl (string; optional)",
      "- traxcnUrl (string; optional)",
      "- fundingTotalUSD (number; optional)",
      "- lastFunding (object: { round, amountUSD?, date? in DD-MM-YYYY }; optional)",
      "- isPublic (boolean; optional)",
      "- ticker (string; optional)",
      "- sources (array of strings; URLs referenced from the search results that are specifically about this company)",
      "- confidence (number; 0.0-1.0 model confidence based on search result quality)",
      "STRICT VALIDATION RULES:",
      "1. Each company MUST have a unique websiteUrl and domain - no duplicates allowed",
      "2. If multiple companies appear related, ensure each has distinct website information",
      "3. Double-check that no company data has been mixed or contaminated with another company's information",
      "4. Prefer fewer, accurate companies over many companies with merged/incorrect data",
      "Matching: If multiple companies match by prefix, return up to 20 of the most relevant, but ensure each is completely distinct.",
      "Output policy: The response MUST be a single valid JSON object with a 'companies' array containing all found companies.",
      "CRITICAL: Always return the exact format: { \"companies\": [ { ...company fields... } ] } and no other text.",
      "Validation: Ensure strictly valid JSON. If a field is unknown, omit it rather than guessing. Dates must be formatted exactly as DD-MM-YYYY.",
    ].join(" ");

    // Use OpenRouter without online search since we already have web data
    const client = (this.openRouterProvider as any).client;
    
    try {
      const response = await client.chat.completions.create({
        model: 'moonshotai/kimi-k2:free', // No online search needed, we have web data
        messages: [
          { role: 'system', content: enhancedPrompt },
          { role: 'user', content: query }
        ],
        temperature: 0.3,
        max_tokens: 4000,
      });

      const outputText = response.choices[0]?.message?.content;
      
      if (!outputText) {
        throw new Error("Failed to extract model output from Tavily-enhanced processing");
      }

      // Parse the response using the same logic as OpenRouterProvider
      const parsedResult = (this.openRouterProvider as any).strictParseCompanies(outputText, query) || { companies: [] };
      
      // Validate and clean the results to prevent data contamination
      const validatedResult = this.validateAndCleanCompanies(parsedResult, query);
      
      return validatedResult;

    } catch (error) {
      console.error(`HybridFallbackProvider: Error processing Tavily data:`, error);
      throw error;
    }
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
}
