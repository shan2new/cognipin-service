import * as fs from 'fs';
import * as path from 'path';
import { config } from 'dotenv';
import { AppDataSource } from '../data-source';
import { Role } from '../schema/role.entity';

config();

const ROOT = path.join(__dirname, '../../');
const INPUT_FILE = path.join(ROOT, 'tech-roles.cleaned.txt');

interface ElasticsearchClient {
  index(params: any): Promise<any>;
  indices: {
    exists(params: { index: string }): Promise<boolean>;
    create(params: any): Promise<any>;
    putSettings(params: any): Promise<any>;
  };
}

// Simple Elasticsearch client using fetch
class SimpleESClient implements ElasticsearchClient {
  constructor(private url: string, private apiKey: string) {}

  private async request(method: string, endpoint: string, body?: any) {
    const response = await fetch(`${this.url}${endpoint}`, {
      method,
      headers: {
        'Authorization': `ApiKey ${this.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: body ? JSON.stringify(body) : undefined
    });

    if (!response.ok) {
      throw new Error(`ES request failed: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  async index(params: any) {
    const { index, id, body } = params;
    const endpoint = `/${index}/_doc${id ? `/${id}` : ''}`;
    return this.request('POST', endpoint, body);
  }

  indices = {
    exists: async (params: { index: string }) => {
      try {
        const response = await fetch(`${this.url}/${params.index}`, {
          method: 'HEAD',
          headers: { 'Authorization': `ApiKey ${this.apiKey}` }
        });
        return response.ok;
      } catch {
        return false;
      }
    },

    create: async (params: any) => {
      return this.request('PUT', `/${params.index}`, params.body);
    },

    putSettings: async (params: any) => {
      return this.request('PUT', `/${params.index}/_settings`, params.body);
    }
  };
}

// Generate synonyms for a role title
function generateSynonyms(title: string): string[] {
  const synonyms = new Set<string>();
  const normalized = title.toLowerCase().trim();
  
  // Add the normalized title itself
  synonyms.add(normalized);
  
  // Common abbreviation expansions we implemented in the cleaner
  const expansions = [
    // SDE patterns
    { pattern: /\bsoftware development engineer\s+(i{1,3}|iv|v|vi|[1-6])\b/gi, replacement: 'sde $1' },
    { pattern: /\bsoftware development engineer\b/gi, replacement: 'sde' },
    // SWE patterns  
    { pattern: /\bsoftware engineer\s+(i{1,3}|iv|v|vi|[1-6])\b/gi, replacement: 'swe $1' },
    { pattern: /\bsoftware engineer\b/gi, replacement: 'swe' },
    // Common abbreviations
    { pattern: /\bquality assurance\b/gi, replacement: 'qa' },
    { pattern: /\bmachine learning\b/gi, replacement: 'ml' },
    { pattern: /\bartificial intelligence\b/gi, replacement: 'ai' },
    { pattern: /\bdevops\b/gi, replacement: 'dev ops' },
    { pattern: /\bfrontend\b/gi, replacement: 'front end' },
    { pattern: /\bbackend\b/gi, replacement: 'back end' },
  ];

  // Generate abbreviation synonyms
  for (const expansion of expansions) {
    if (expansion.pattern.test(title)) {
      const abbreviated = normalized.replace(expansion.pattern, expansion.replacement);
      if (abbreviated !== normalized) {
        synonyms.add(abbreviated);
      }
    }
  }

  // Level variants (Roman <-> Numeric)
  const levelMappings = [
    { roman: 'i', numeric: '1' },
    { roman: 'ii', numeric: '2' },
    { roman: 'iii', numeric: '3' },
    { roman: 'iv', numeric: '4' },
    { roman: 'v', numeric: '5' },
    { roman: 'vi', numeric: '6' },
  ];

  for (const mapping of levelMappings) {
    if (normalized.includes(` ${mapping.roman} `) || normalized.endsWith(` ${mapping.roman}`)) {
      const numericVariant = normalized.replace(new RegExp(`\\b${mapping.roman}\\b`, 'g'), mapping.numeric);
      synonyms.add(numericVariant);
    }
    if (normalized.includes(` ${mapping.numeric} `) || normalized.endsWith(` ${mapping.numeric}`)) {
      const romanVariant = normalized.replace(new RegExp(`\\b${mapping.numeric}\\b`, 'g'), mapping.roman);
      synonyms.add(romanVariant);
    }
  }

  return Array.from(synonyms).filter(s => s !== normalized); // Exclude the original
}

// Normalize title for database storage (unique constraint)
function normalizeTitle(title: string): string {
  return title.toLowerCase().trim().replace(/\s+/g, ' ');
}

async function setupElasticsearchIndex(client: ElasticsearchClient, indexName: string) {
  const exists = await client.indices.exists({ index: indexName });
  
  if (!exists) {
    console.log(`Creating Elasticsearch index: ${indexName}`);
    await client.indices.create({
      index: indexName,
      body: {
        settings: {
          analysis: {
            analyzer: {
              role_analyzer: {
                type: 'custom',
                tokenizer: 'standard',
                filter: ['lowercase', 'stop', 'role_synonyms']
              }
            },
            filter: {
              role_synonyms: {
                type: 'synonym',
                synonyms: []  // We'll populate this dynamically
              }
            }
          }
        },
        mappings: {
          properties: {
            id: { type: 'keyword' },
            title: { 
              type: 'text',
              analyzer: 'role_analyzer',
              fields: {
                keyword: { type: 'keyword' },
                ngram: {
                  type: 'text',
                  analyzer: 'standard'
                }
              }
            },
            normalized_title: { type: 'keyword' },
            synonyms: { 
              type: 'text',
              analyzer: 'role_analyzer'
            },
            created_at: { type: 'date' },
            updated_at: { type: 'date' }
          }
        }
      }
    });
  }
}

async function main() {
  // Validate environment
  const esUrl = process.env.ELASTICSEARCH_URL;
  const esApiKey = process.env.ELASTICSEARCH_API_KEY;
  
  if (!esUrl || !esApiKey) {
    console.error('Missing required environment variables: ELASTICSEARCH_URL, ELASTICSEARCH_API_KEY');
    process.exit(1);
  }

  if (!fs.existsSync(INPUT_FILE)) {
    console.error(`Input file not found: ${INPUT_FILE}`);
    process.exit(1);
  }

  // Read roles from cleaned file
  const rawContent = fs.readFileSync(INPUT_FILE, 'utf8');
  const roleLines = rawContent.split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0);

  console.log(`Found ${roleLines.length} roles to process`);

  // Initialize database connection
  console.log('Connecting to database...');
  await AppDataSource.initialize();
  const roleRepository = AppDataSource.getRepository(Role);

  // Initialize Elasticsearch
  console.log('Connecting to Elasticsearch...');
  const esClient = new SimpleESClient(esUrl, esApiKey);
  const indexName = 'roles';
  await setupElasticsearchIndex(esClient, indexName);

  let createdCount = 0;
  let skippedCount = 0;
  let esIndexedCount = 0;

  for (const roleTitle of roleLines) {
    const normalizedTitle = normalizeTitle(roleTitle);
    
    try {
      // Check if role already exists
      const existingRole = await roleRepository.findOne({
        where: { normalized_title: normalizedTitle }
      });

      let role: Role;
      
      if (existingRole) {
        console.log(`Role already exists: ${roleTitle}`);
        role = existingRole;
        skippedCount++;
      } else {
        // Create new role
        const synonyms = generateSynonyms(roleTitle);
        
        role = roleRepository.create({
          title: roleTitle,
          normalized_title: normalizedTitle,
          synonyms: synonyms.length > 0 ? synonyms : null,
          group_id: null, // Not assigning to groups for now
        });

        await roleRepository.save(role);
        console.log(`Created role: ${roleTitle} (ID: ${role.id})`);
        createdCount++;
      }

      // Index in Elasticsearch
      try {
        await esClient.index({
          index: indexName,
          id: role.id,
          body: {
            id: role.id,
            title: role.title,
            normalized_title: role.normalized_title,
            synonyms: role.synonyms || [],
            created_at: role.created_at,
            updated_at: role.updated_at
          }
        });
        esIndexedCount++;
      } catch (esError) {
        console.error(`Failed to index role in ES: ${roleTitle}`, esError);
      }

    } catch (dbError) {
      console.error(`Failed to process role: ${roleTitle}`, dbError);
    }
  }

  // Close database connection
  await AppDataSource.destroy();

  console.log('\n--- Summary ---');
  console.log(`Total roles processed: ${roleLines.length}`);
  console.log(`Created in database: ${createdCount}`);
  console.log(`Skipped (already exists): ${skippedCount}`);
  console.log(`Indexed in Elasticsearch: ${esIndexedCount}`);
  console.log(`Elasticsearch index: ${indexName}`);
}

main().catch((error) => {
  console.error('Script failed:', error);
  process.exit(1);
});
