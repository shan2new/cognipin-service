const { tavily } = require('@tavily/core');

export interface TavilySearchResult {
  title: string;
  url: string;
  content: string;
  domain: string;
  score: number;
}

export interface TavilySearchResponse {
  results: TavilySearchResult[];
  query: string;
  hasResults: boolean;
}

export interface WebSearchProvider {
  search(query: string, options?: { maxResults?: number; searchDepth?: 'basic' | 'advanced' }): Promise<TavilySearchResponse>;
  searchCompanyInfo(companyName: string): Promise<TavilySearchResponse>;
}

export class TavilyProvider implements WebSearchProvider {
  private client: any;

  constructor(apiKey: string) {
    this.client = tavily({ apiKey });
  }

  async search(
    query: string, 
    options: { maxResults?: number; searchDepth?: 'basic' | 'advanced' } = {}
  ): Promise<TavilySearchResponse> {
    const { maxResults = 10, searchDepth = 'basic' } = options;

    try {
      const response = await this.client.search(query, {
        maxResults,
        searchDepth,
        includeDomains: [
          'crunchbase.com',
          'linkedin.com',
          'traxcn.com',
          'bloomberg.com',
          'techcrunch.com',
          'forbes.com',
          'reuters.com',
          'sec.gov',
          'companieshouse.gov.uk'
        ],
        excludeDomains: [
          'wikipedia.org',
          'facebook.com',
          'twitter.com',
          'instagram.com',
          'youtube.com'
        ]
      });

      const results: TavilySearchResult[] = (response.results || []).map((result: any) => ({
        title: result.title || '',
        url: result.url || '',
        content: result.content || '',
        domain: this.extractDomain(result.url || ''),
        score: result.score || 0
      }));

      // Consider search successful if we have meaningful results
      const hasResults = results.length > 0 && results.some(r => r.score > 0.3);

      return {
        results,
        query,
        hasResults
      };
    } catch (error) {
      console.error(`Tavily search error for query "${query}":`, error);
      return {
        results: [],
        query,
        hasResults: false
      };
    }
  }

  async searchCompanyInfo(companyName: string): Promise<TavilySearchResponse> {
    const enhancedQuery = `${companyName} company funding valuation employees headquarters founded crunchbase linkedin`;
    return this.search(enhancedQuery, { maxResults: 15 });
  }

  private extractDomain(url: string): string {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname.replace(/^www\./, '');
    } catch {
      return '';
    }
  }
}
