import OpenAI from "openai";

type Company = {
  name: string;
  websiteUrl: string;           // Official website URL (used later for Clearbit logo)
  domain: string;               // Extracted domain from official website
  dateOfIncorporation: string;  // DD-MM-YYYY
  foundedYear?: string;         // YYYY (optional convenience)
  description?: string;         // 1–2 line summary
  industries?: string[];        // e.g., ["FinTech", "SaaS"]
  hq?: { city?: string; country?: string };
  employeeCount?: string;       // e.g., "201-500"
  founders?: { name: string; role?: string }[];
  leadership?: { name: string; title: string }[]; // CEO, CTO, etc.
  linkedinUrl?: string;
  crunchbaseUrl?: string;
  traxcnUrl?: string;
  fundingTotalUSD?: number;
  lastFunding?: { round?: string; amountUSD?: number; date?: string };
  isPublic?: boolean;
  ticker?: string;
  sources: string[];            // URLs referenced to derive fields
  confidence: number;           // 0.0–1.0 model confidence in correctness
};

type CompaniesResult = {
  companies: Company[];
};

function getArgValue(flag: string): string | undefined {
  const index = process.argv.findIndex((arg) => arg === flag || arg.startsWith(`${flag}=`));
  if (index === -1) return undefined;
  const equalArg = process.argv[index];
  if (equalArg.includes("=")) {
    return equalArg.split("=").slice(1).join("=");
  }
  return process.argv[index + 1];
}

async function main(): Promise<void> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error("Error: OPENAI_API_KEY environment variable is not set.");
    process.exit(1);
  }

  const queryFromArg = getArgValue("--query") || getArgValue("-q");
  const query = queryFromArg || process.argv.slice(2).filter((v) => !v.startsWith("-"))[0];
  if (!query) {
    console.error("Usage: npx ts-node src/scripts/fetch-companies.ts --query \"input string\"");
    process.exit(1);
  }

  const client = new OpenAI({ apiKey });

  const prompt = [
    "You are a research assistant with web search enabled.",
    "Task: Given the input string, identify companies explicitly or implicitly referenced (including prefix matches).",
    "Geographic disambiguation: Only software entities with hq first in India, then US, then UK, then Europe, then rest of the world. In that order.",
    "Data sources: Prioritize Traxcn, Crunchbase, the company's official website, and the company's LinkedIn page. You may also use reputable news/press releases for funding and incorporation dates.",
    "IMPORTANT: Do NOT return a logo image URL. Instead, return the company's OFFICIAL website URL and its domain. ",
    "For each company, extract the following fields: \n" +
      "- name (string)\n" +
      "- websiteUrl (string; official site, HTTPS preferred)\n" +
      "- foundedYear (string; YYYY; optional)\n" +
      "- industry (string)\n" +
      "- hq (object with optional city, country)\n" +
      "- lastFunding (object: { round, amountUSD?, date? in DD-MM-YYYY }; Thoroughly verify the round amount and round type and ensure it is latest according to 2025; Verify if amount is in USD, otherwise convert it to USD in Millions)\n" +
      "- isPublic (boolean)\n" +
    "Matching: If multiple companies match by prefix, return up to 20 of the most relevant.",
    "Output policy: The response MUST be a single valid JSON object with no extra text.",
    "Validation: Ensure strictly valid JSON. If a field is unknown, omit it rather than guessing. Dates must be formatted exactly as DD-MM-YYYY.",
  ].join(" ");


  const response = await client.chat.completions.create({
    model: "meta-llama/llama-3.2-3b-instruct",
    messages: [
      { role: "system", content: prompt },
      { role: "user", content: query },
    ],
  });

  // Extract content from the chat completion response structure
  const outputText = response.choices[0]?.message?.content;
  
  if (!outputText) {
    console.error("Failed to extract model output.");
    process.exit(1);
  }

  let parsed: CompaniesResult | undefined;
  try {
    parsed = JSON.parse(outputText) as CompaniesResult;
  } catch {
    console.error("Model did not return valid JSON. Raw output:\n" + outputText);
    process.exit(1);
  }

  // NOTE: Downstream logo retrieval example (outside this script):
  // const logo = `https://logo.clearbit.com/${company.domain}`;
  // Prefer PNG/SVG fallback handling at the consumer side.

  console.log(JSON.stringify(parsed, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
