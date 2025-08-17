export interface CompanySearchResult {
  name: string;
  websiteUrl: string;
  domain: string;
  dateOfIncorporation: string;
  foundedYear?: string;
  description?: string;
  industries?: string[];
  hq?: { city?: string; country?: string };
  employeeCount?: string;
  founders?: { name: string; role?: string }[];
  leadership?: { name: string; title: string }[];
  linkedinUrl?: string;
  crunchbaseUrl?: string;
  traxcnUrl?: string;
  fundingTotalUSD?: number;
  lastFunding?: { round?: string; amountUSD?: number; date?: string };
  isPublic?: boolean;
  ticker?: string;
  sources: string[];
  confidence: number;
}

export interface CompanySearchResponse {
  companies: CompanySearchResult[];
}

export interface AIProvider {
  searchCompanies(query: string): Promise<CompanySearchResponse>;
}

export interface RateLimiter {
  canProceed(): Promise<boolean>;
  recordRequest(): void;
}

export interface LogoDownloader {
  downloadLogo(domain: string): Promise<string | null>; // Returns base64 encoded image
}
