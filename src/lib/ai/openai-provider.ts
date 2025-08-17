import OpenAI from 'openai';
import { AIProvider, CompanySearchResponse } from './interfaces';

export class OpenAIProvider implements AIProvider {
  private client: OpenAI;

  constructor(apiKey: string) {
    this.client = new OpenAI({ apiKey });
  }

  async searchCompanies(query: string): Promise<CompanySearchResponse> {
    const prompt = [
      "You are a research assistant with web search enabled.",
      "Task: Given the input string, identify companies explicitly or implicitly referenced (including prefix matches).",
      "Geographic disambiguation: Only software entities with hq first in India, then US, then UK, then Europe, then rest of the world. In that order.",
      "Data sources: Prioritize Traxcn, Crunchbase, the company's official website, and the company's LinkedIn page. You may also use reputable news/press releases for funding and incorporation dates.",
      "IMPORTANT: Do NOT return a logo image URL. Instead, return the company's OFFICIAL website URL and its domain. ",
      "For each company, extract the following fields: \n" +
        "- name (string)\n" +
        "- websiteUrl (string; official site, HTTPS preferred)\n" +
        "- domain (string; extracted from websiteUrl)\n" +
        "- dateOfIncorporation (string; DD-MM-YYYY)\n" +
        "- foundedYear (string; YYYY; optional)\n" +
        "- description (string; 1-2 line summary; optional)\n" +
        "- industries (array of strings; optional)\n" +
        "- hq (object with optional city, country)\n" +
        "- employeeCount (string; optional)\n" +
        "- founders (array of objects with name and optional role; optional)\n" +
        "- leadership (array of objects with name and title; optional)\n" +
        "- linkedinUrl (string; optional)\n" +
        "- crunchbaseUrl (string; optional)\n" +
        "- traxcnUrl (string; optional)\n" +
        "- fundingTotalUSD (number; optional)\n" +
        "- lastFunding (object: { round, amountUSD?, date? in DD-MM-YYYY }; optional)\n" +
        "- isPublic (boolean; optional)\n" +
        "- ticker (string; optional)\n" +
        "- sources (array of strings; URLs referenced)\n" +
        "- confidence (number; 0.0-1.0 model confidence)\n" +
      "Matching: If multiple companies match by prefix, return up to 20 of the most relevant.",
      "Output policy: The response MUST be a single valid JSON object with a 'companies' array containing all found companies.",
      "CRITICAL: Always return the exact format: { \"companies\": [ { ...company fields... } ] } and no other text.",
      "Validation: Ensure strictly valid JSON. If a field is unknown, omit it rather than guessing. Dates must be formatted exactly as DD-MM-YYYY.",
    ].join(" ");

    const response = await this.client.chat.completions.create({
      model: "gpt-4o-mini-search-preview",
      messages: [
        { role: "system", content: prompt },
        { role: "user", content: query },
      ],
    });

    const outputText = response.choices[0]?.message?.content;
    
    if (!outputText) {
      throw new Error("Failed to extract model output.");
    }

    // First attempt: strict parse of the model output
    const firstParse = this.strictParseCompanies(outputText, query);
    if (firstParse) {
      return firstParse;
    }

    // Second attempt: ask the model to convert its own output into strict JSON
    const reformatSystem = [
      "You will be given some content.",
      "Convert it into a STRICT JSON object with the exact shape { companies: Company[] }.",
      "Do not add any commentary. Output JSON only.",
    ].join(" ");

    const reformatMessages = [
      { role: "system" as const, content: reformatSystem },
      { role: "user" as const, content: this.buildSchemaInstruction() },
      { role: "user" as const, content: outputText },
    ];

    const reformatted = await this.client.chat.completions.create({
      model: "gpt-4o-mini-search-preview",
      messages: reformatMessages,
    });
    const reformattedText = reformatted.choices[0]?.message?.content || '';
    const secondParse = this.strictParseCompanies(reformattedText, query);
    if (secondParse) {
      return secondParse;
    }

    console.error(`Model did not return valid JSON for query "${query}" after retry. Raw outputs:`, { outputText, reformattedText });
    return { companies: [] };
  }

  private buildSchemaInstruction(): string {
    return [
      "The JSON MUST match this TypeScript-like schema:",
      "{",
      "  companies: Array<{",
      "    name: string;",
      "    websiteUrl: string;",
      "    domain: string;",
      "    dateOfIncorporation: string;",
      "    foundedYear?: string;",
      "    description?: string;",
      "    industries?: string[];",
      "    hq?: { city?: string; country?: string };",
      "    employeeCount?: string;",
      "    founders?: { name: string; role?: string }[];",
      "    leadership?: { name: string; title: string }[];",
      "    linkedinUrl?: string;",
      "    crunchbaseUrl?: string;",
      "    traxcnUrl?: string;",
      "    fundingTotalUSD?: number;",
      "    lastFunding?: { round?: string; amountUSD?: number; date?: string };",
      "    isPublic?: boolean;",
      "    ticker?: string;",
      "    sources: string[];",
      "    confidence: number;",
      "  }>;",
      "}",
      "Return only JSON."
    ].join("\n");
  }

  private strictParseCompanies(raw: string, query: string): CompanySearchResponse | null {
    // Remove code fences
    let text = (raw || '').trim();
    if (text.startsWith('```json')) {
      text = text.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    } else if (text.startsWith('```')) {
      text = text.replace(/^```\s*/, '').replace(/\s*```$/, '');
    }

    // Try direct JSON parse
    const direct = this.tryNormalizeParsedJSON(text, query);
    if (direct) return direct;

    // Try to extract JSON substring between first '{' and last '}'
    const firstBrace = text.indexOf('{');
    const lastBrace = text.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      const candidate = text.slice(firstBrace, lastBrace + 1);
      const extracted = this.tryNormalizeParsedJSON(candidate, query);
      if (extracted) return extracted;
    }

    return null;
  }

  private tryNormalizeParsedJSON(jsonText: string, query: string): CompanySearchResponse | null {
    try {
      const parsed: any = JSON.parse(jsonText);

      if (!parsed || typeof parsed !== 'object') {
        return null;
      }

      if (Array.isArray(parsed.companies)) {
        return { companies: parsed.companies };
      }

      // Handle single company object case
      if (parsed.name && parsed.websiteUrl) {
        console.warn(`Model returned single company object instead of companies array for query "${query}". Converting to array format.`);
        return { companies: [parsed] };
      }

      return null;
    } catch {
      return null;
    }
  }
}
