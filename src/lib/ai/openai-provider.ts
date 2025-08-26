import OpenAI from 'openai';
import { AIProvider, CompanySearchResponse, RoleSuggestionContext, RoleSuggestionResponse } from './interfaces';

export class OpenAIProvider implements AIProvider {
  private client: OpenAI;

  constructor(apiKey: string) {
    this.client = new OpenAI({ apiKey });
  }

  async suggestRoles(context: RoleSuggestionContext): Promise<RoleSuggestionResponse> {
    const systemPrompt = [
      'You suggest precise job role titles for a candidate applying to a specific company.',
      'Given company and user context, produce 5-8 role titles that fit the user and are common at the target company.',
      'Rules:',
      '- Prefer standardized, searchable titles (e.g., "Senior Frontend Engineer", "Full-Stack Developer", "Product Manager").',
      '- Avoid internal-only ladders or overly niche titles.',
      '- Include variants across seniority if reasonable.',
      '- Keep titles concise; provide a short reason and confidence 0.0-1.0.',
      'Output MUST be strict JSON only in shape: { "suggestions": [ { "role": string, "reason"?: string, "confidence"?: number } ] }.'
    ].join(' ');

    const userContent = [
      `Company: ${JSON.stringify(context.company)}`,
      `User: ${JSON.stringify(context.user)}`,
      'Return only JSON as specified.'
    ].join('\n');

    try {
      const response = await this.client.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userContent }
        ],
        temperature: 0.2,
        max_tokens: 800,
      });

      const outputText = response.choices[0]?.message?.content || '';
      const first = this.strictParseRoleSuggestions(outputText);
      if (first) return first;

      // Reformat attempt
      const reformat = await this.client.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'Convert the following into STRICT JSON that matches { suggestions: Array<{ role: string; reason?: string; confidence?: number }> }. Output JSON only.' },
          { role: 'user', content: outputText }
        ],
        temperature: 0,
        max_tokens: 800,
      });
      const reformatted = reformat.choices[0]?.message?.content || '';
      const second = this.strictParseRoleSuggestions(reformatted);
      if (second) return second;

      console.error('OpenAIProvider suggestRoles: failed to parse JSON', { outputText, reformatted });
      return { suggestions: [] };
    } catch (err) {
      console.error('OpenAIProvider suggestRoles error:', err);
      return { suggestions: [] };
    }
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

  private strictParseRoleSuggestions(raw: string): RoleSuggestionResponse | null {
    let text = (raw || '').trim();
    if (text.startsWith('```json')) {
      text = text.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    } else if (text.startsWith('```')) {
      text = text.replace(/^```\s*/, '').replace(/\s*```$/, '');
    }

    try {
      const parsed: any = JSON.parse(text);
      if (parsed && Array.isArray(parsed.suggestions)) {
        return {
          suggestions: parsed.suggestions
            .map((s: any) => ({
              role: String(s.role ?? s).trim(),
              reason: s.reason,
              confidence: typeof s.confidence === 'number' ? s.confidence : undefined,
            }))
            .filter((s: any) => s.role),
        };
      }
      if (Array.isArray(parsed)) {
        return { suggestions: parsed.map((r: any) => ({ role: String(r).trim() })).filter((s: any) => s.role) };
      }
      if (parsed && Array.isArray(parsed.roles)) {
        return { suggestions: parsed.roles.map((r: any) => ({ role: String(r).trim() })).filter((s: any) => s.role) };
      }
      return null;
    } catch {
      const firstBrace = text.indexOf('{');
      const lastBrace = text.lastIndexOf('}');
      if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
        try {
          const candidate = text.slice(firstBrace, lastBrace + 1);
          const parsed: any = JSON.parse(candidate);
          if (parsed && Array.isArray(parsed.suggestions)) {
            return {
              suggestions: parsed.suggestions
                .map((s: any) => ({
                  role: String(s.role ?? s).trim(),
                  reason: s.reason,
                  confidence: typeof s.confidence === 'number' ? s.confidence : undefined,
                }))
                .filter((s: any) => s.role),
            };
          }
        } catch {
          // Ignore parsing errors for candidate JSON
        }
      }
      return null;
    }
  }
}
