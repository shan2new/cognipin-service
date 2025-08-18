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
      "IMPORTANT: Use the provided web search results to extract accurate company information. Do NOT return a logo image URL. Instead, return the company's OFFICIAL website URL and its domain.",
      "Web Search Results:",
      webContext,
      "",
      "For each company, extract the following fields based on the web search results:",
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
      "- sources (array of strings; URLs referenced from the search results)",
      "- confidence (number; 0.0-1.0 model confidence based on search result quality)",
      "Matching: If multiple companies match by prefix, return up to 20 of the most relevant.",
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
      return (this.openRouterProvider as any).strictParseCompanies(outputText, query) || { companies: [] };

    } catch (error) {
      console.error(`HybridFallbackProvider: Error processing Tavily data:`, error);
      throw error;
    }
  }
}
