import * as fs from 'fs';
import * as path from 'path';
import { config } from 'dotenv';

config();

const ROOT = path.join(__dirname, '../../');
const INPUT_FILE = path.join(ROOT, 'tech-roles.txt');
const OUTPUT_FILE = path.join(ROOT, 'tech-roles.cleaned.txt');

// Known companies (extendable)
const COMPANIES = new Set<string>([
  'amazon', 'google', 'alphabet', 'microsoft', 'meta', 'facebook', 'apple', 'netflix', 'uber', 'airbnb', 'twitter', 'x',
  'linkedin', 'salesforce', 'oracle', 'ibm', 'intel', 'amd', 'nvidia', 'tesla', 'spacex', 'shopify', 'doordash', 'snowflake',
  'stripe', 'coinbase', 'tiktok', 'bytedance', 'adobe', 'paypal', 'square', 'block', 'zoom', 'dropbox', 'slack', 'atlassian'
]);

function isCategoryHeader(line: string): boolean {
  const l = line.trim();
  if (!l) return true; // treat empty as header/skip
  if (l.startsWith('#')) return true; // markdown header
  if (l.includes('**')) return true; // starred headings
  if (/\bRoles\b/i.test(l)) return true; // lines describing categories like "Director Roles"
  if (/^[-*•]/.test(l)) return true; // bullet headings
  if (/^\d+\./.test(l)) return true; // numbered list
  // Pure company line like "Amazon:" or "AMD:"
  if (/^[A-Za-z0-9 .&/()+-]+:$/i.test(l)) return true;
  return false;
}

function stripBulletsAndNumbers(line: string): string {
  return line
    .replace(/^\s*[-*•]\s*/, '') // bullets
    .replace(/^\s*\d+\.\s*/, '') // numbering
    .trim();
}

// Remove company prefixes like "Amazon - ..." or "Google: ..." repeatedly
function stripCompanyPrefix(line: string): { text: string; didStrip: boolean } {
  let text = line.trim();
  let did = false;
  while (true) {
    const m = text.match(/^(.*?)\s*[:—-]\s*(.+)$/); // prefix: rest
    if (!m) break;
    const prefix = m[1].trim();
    const rest = m[2].trim();
    // If prefix looks like a known company (or ends with ")" in case of things like Twitter/X)
    const normalized = prefix.toLowerCase().replace(/\([^)]*\)/g, '').trim();
    if (COMPANIES.has(normalized)) {
      text = rest;
      did = true;
      continue;
    }
    // Heuristic: single word or two-word proper noun could be a company
    if (/^[A-Z][A-Za-z0-9]*(?:\s+[A-Z][A-Za-z0-9/]*)?$/.test(prefix)) {
      text = rest;
      did = true;
      continue;
    }
    break;
  }
  return { text, didStrip: did };
}

// Remove parentheticals if they contain a known company name
function stripCompanyParentheticals(line: string): string {
  return line.replace(/\(([^)]*)\)/g, (full, inside) => {
    const token = String(inside || '').toLowerCase();
    for (const c of COMPANIES) {
      if (token.includes(c)) return '';
    }
    return full; // keep non-company parentheticals
  }).replace(/\s{2,}/g, ' ').trim();
}

// Remove all parentheticals that look like levels or miscellaneous notes, e.g., (L4), (Senior), (Contract)
function stripAllParentheticals(line: string): string {
  let text = line;
  // Remove any content within parentheses entirely
  text = text.replace(/\([^)]*\)/g, '').replace(/\s{2,}/g, ' ').trim();
  // Clean up dangling unmatched parentheses just in case
  text = text.replace(/[()]/g, '').trim();
  return text;
}

function splitCompoundRoles(line: string): string[] {
  // Split by commas, but ignore commas inside parentheses
  const parts: string[] = [];
  let buf = '';
  let depth = 0;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '(') {
      depth++;
      buf += ch;
      continue;
    }
    if (ch === ')') {
      depth = Math.max(0, depth - 1);
      buf += ch;
      continue;
    }
    if (ch === ',' && depth === 0) {
      const val = buf.trim();
      if (val) parts.push(val);
      buf = '';
      continue;
    }
    buf += ch;
  }
  const tail = buf.trim();
  if (tail) parts.push(tail);
  if (parts.length <= 1) return [line.trim()];
  return parts;
}

function normalizeRole(role: string): string {
  let r = role.trim();
  // Remove trailing punctuation
  r = r.replace(/[.;:]+$/g, '').trim();
  // Normalize multiple spaces
  r = r.replace(/\s{2,}/g, ' ');
  // Remove stray leading/trailing quotes or dashes
  r = r.replace(/^[-–—\s]+/, '').replace(/[-–—\s]+$/, '').trim();
  return r;
}

// Role heuristics
const ROLE_KEYWORDS = [
  'engineer','developer','manager','architect','scientist','analyst','specialist','consultant','administrator','admin',
  'lead','director','vp','chief','officer','designer','researcher','tester','qa','sre','pm','product manager','program manager',
  'owner','producer','operator','ops','support','staff','principal','intern','apprentice','evangelist'
];

const HIERARCHICAL_CODES = [
  /^(?:sde\s*(?:i{1,3}|[1-6]))$/i, // SDE I/II/III or SDE1..6
  /^(?:e[2-7])$/i,                  // E2..E7
  /^(?:ict[1-7])$/i,                // ICT1..ICT7
  /^(?:t[3-7])$/i                   // T3..T7 (Google eng ladder)
];

function looksLikeRole(line: string): boolean {
  const l = line.trim();
  if (!l) return false;
  if (isCategoryHeader(l)) return false;
  // Common noise tokens
  if (/^(?:and|etc\.?|others|misc|various)$/i.test(l)) return false;

  const lower = l.toLowerCase();

  // Allow known hierarchical codes (e.g., SDE2)
  if (HIERARCHICAL_CODES.some((rx) => rx.test(lower))) return true;

  // Keep acronyms that are well-known roles
  if (/^(?:sre|qa|cto|ciso|cio|cpo)$/i.test(lower)) return true;

  // Must contain at least one role keyword
  const hasKeyword = ROLE_KEYWORDS.some((kw) => lower.includes(kw));
  if (!hasKeyword) return false;

  // Basic sanity: drop overly short non-acronym items
  const words = lower.split(/\s+/).filter(Boolean);
  if (words.length === 1 && !/^[A-Z]{2,5}$/i.test(l)) return false;

  return true;
}

function cleanLines(lines: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();

  for (let raw of lines) {
    let line = raw.trim();
    if (!line) continue;

    // Skip category-like headers early
    if (isCategoryHeader(line)) continue;

    // Strip bullets/numbers
    line = stripBulletsAndNumbers(line);

    // Remove repeated company prefixes
    let prev: string | null = null;
    while (prev !== line) {
      prev = line;
      const res = stripCompanyPrefix(line);
      line = res.text;
    }

    // Remove company parentheticals
    line = stripCompanyParentheticals(line);

    // Remove all remaining parentheticals (levels, notes)
    line = stripAllParentheticals(line);

    // Skip again if it now looks like a header
    if (isCategoryHeader(line)) continue;

    // Sometimes a line can still contain a company keyword at start like "Amazon Security Engineer"
    // If first token is a known company, drop it
    const tokens = line.split(/\s+/);
    if (tokens.length > 1 && COMPANIES.has(tokens[0].toLowerCase().replace(/:$/, ''))) {
      line = tokens.slice(1).join(' ');
    }

    // Expand compound roles (comma-separated)
    const roles = splitCompoundRoles(line);

    for (let role of roles) {
      role = normalizeRole(role);
      if (!looksLikeRole(role)) continue;
      // Avoid keeping plain company names
      if (COMPANIES.has(role.toLowerCase())) continue;
      const key = role.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        out.push(role);
      }
    }
  }

  // Sort alphabetically, case-insensitive
  out.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
  return out;
}

// --- Abbreviation expansion (SDE/SWE) ---
const ROMAN_TO_NUMBER: Record<string, number> = { i: 1, ii: 2, iii: 3, iv: 4, v: 5, vi: 6 };
const NUMBER_TO_ROMAN: Record<number, string> = { 1: 'I', 2: 'II', 3: 'III', 4: 'IV', 5: 'V', 6: 'VI' };

function levelVariants(lvl: string | undefined): string[] {
  if (!lvl) return [''];
  const lc = lvl.toLowerCase();
  const variants: string[] = [];
  if (lc in ROMAN_TO_NUMBER) {
    const n = ROMAN_TO_NUMBER[lc as keyof typeof ROMAN_TO_NUMBER];
    variants.push(` ${NUMBER_TO_ROMAN[n]}`);
    variants.push(` ${n}`);
  } else if (/^[1-6]$/.test(lc)) {
    const n = parseInt(lc, 10);
    variants.push(` ${NUMBER_TO_ROMAN[n]}`);
    variants.push(` ${n}`);
  } else {
    variants.push(` ${lvl}`);
  }
  return variants;
}

function expandSdeSwe(role: string): string[] {
  const res: string[] = [];
  // SDE expansion
  const sde = role.match(/^(?<prefix>(?:Senior|Principal|Staff)\s+)?SDE(?:\s*(?<lvl>I{1,3}|IV|V|VI|[1-6]))?(?<rest>.*)$/i);
  if (sde && sde.groups) {
    const prefix = sde.groups.prefix ? sde.groups.prefix : '';
    const lvl = sde.groups.lvl as string | undefined;
    const rest = sde.groups.rest ? sde.groups.rest : '';
    for (const v of levelVariants(lvl)) {
      res.push(`${prefix}Software Development Engineer${v}${rest}`.trim());
    }
  }
  // SWE expansion
  const swe = role.match(/^(?<prefix>(?:Senior|Principal|Staff)\s+)?SWE(?:\s*(?<lvl>I{1,3}|IV|V|VI|[1-6]))?(?<rest>.*)$/i);
  if (swe && swe.groups) {
    const prefix = swe.groups.prefix ? swe.groups.prefix : '';
    const lvl = swe.groups.lvl as string | undefined;
    const rest = swe.groups.rest ? swe.groups.rest : '';
    for (const v of levelVariants(lvl)) {
      res.push(`${prefix}Software Engineer${v}${rest}`.trim());
    }
  }
  return res;
}

function expandRoles(roles: string[]): string[] {
  const set = new Set<string>();
  for (const r of roles) set.add(r);
  for (const r of roles) {
    for (const e of expandSdeSwe(r)) {
      if (e && !set.has(e)) set.add(e);
    }
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
}

function main() {
  if (!fs.existsSync(INPUT_FILE)) {
    console.error(`Input file not found: ${INPUT_FILE}`);
    process.exit(1);
  }

  const raw = fs.readFileSync(INPUT_FILE, 'utf8');
  const lines = raw.split(/\r?\n/);
  const cleaned = cleanLines(lines);
  const expanded = expandRoles(cleaned);

  // Write roles-only to a separate cleaned file
  fs.writeFileSync(OUTPUT_FILE, expanded.join('\n') + '\n', 'utf8');
  console.log(`Cleaned ${cleaned.length} roles. After expansions: ${expanded.length}. Output written to ${OUTPUT_FILE}.`);
}

main();
