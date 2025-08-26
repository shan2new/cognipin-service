import * as fs from 'fs';
import * as path from 'path';
import { config } from 'dotenv';
// Use absolute path for imports to avoid ts-node module resolution issues
import { HybridFallbackProvider } from '../../src/lib/ai/hybrid-fallback-provider';

// Load environment variables
config();

// Configuration
const MODEL_ID = 'meta-llama/llama-3.2-3b-instruct:nitro';
const OUTPUT_FILE = path.join(__dirname, '../../tech-roles.txt');

// Initialize OpenRouter client
const openRouterApiKey = process.env.OPENROUTER_API_KEY;
const tavilyApiKey = process.env.TAVILY_API_KEY || '';

if (!openRouterApiKey) {
  console.error('Error: OPENROUTER_API_KEY is required in .env file');
  process.exit(1);
}

// Initialize the HybridFallbackProvider from existing codebase
const provider = new HybridFallbackProvider(openRouterApiKey, tavilyApiKey, {
  primaryModels: [{ 
    id: 'meta-llama/llama-3.2-3b-instruct:nitro', 
    name: 'Llama 3.2 3B', 
    temperature: 0, 
    maxTokens: 2048,
    role: 'primary'
  }]
});

/**
 * Fetch comprehensive tech roles using LLM
 */
async function fetchTechRoles(): Promise<string[]> {
  console.log(`Fetching comprehensive tech roles using the OpenRouter provider...`);
  
  const systemPrompt = `
    You are a comprehensive career database for the technology industry.
    Provide an extensive list of ALL technology-related job titles and roles found across major tech companies.
    Format your response as a plain list with one role per line.
    Include ALL of the following categories:
    - Software Development (all levels, specializations, and frameworks)
    - Quality Assurance and Testing (all types)
    - DevOps, SRE, and Platform Engineering
    - Data Science, Analytics, and Business Intelligence
    - Machine Learning and AI roles
    - Product Management and Product Design
    - UX/UI Design and Research
    - Technical Writing and Documentation
    - Technical Support and Customer Success Engineering
    - IT, Security, and Compliance
    - Engineering Management (all levels)
    - Technical Program Management
    - Hardware Engineering and IoT
    - Cloud Engineering and Architecture
    - Database Administration and Engineering
    - Network Engineering
    - Mobile Development (all platforms)
    - Game Development
    - Blockchain and Web3
    - AR/VR Development
    - Quantum Computing
    Be extremely thorough and include both common and highly specialized/niche roles.
    Include specific job titles with levels (junior, senior, staff, principal, etc.) where relevant.
  `;
  
  const userPrompt = `
    Generate a comprehensive list of ALL technology roles that exist across major tech companies like:
    - Google/Alphabet
    - Amazon
    - Microsoft
    - Apple
    - Meta
    - Netflix
    - Uber
    - Airbnb
    - Twitter/X
    - LinkedIn
    - Salesforce
    - Oracle
    - IBM
    - Intel
    - AMD
    - NVIDIA
    - Tesla
    - SpaceX
    
    Include ALL technical roles, from entry-level to executive positions.
    Include highly specialized positions that might exist only at certain companies.
    Format as a simple list with ONLY the job titles, one per line, with no additional text.
    Be extremely thorough and include at least 200+ unique role titles.
  `;

  try {
    // Create a context object for the suggestRoles method that matches RoleSuggestionContext type
    const roleContext = {
      company: {
        name: "Major Technology Companies",
        description: "All major technology companies including FAANG, enterprise tech, and startups",
        website: null
      },
      user: {
        currentRole: "Technology Professional",
        currentCompany: null
      },
      additionalContext: "Need a comprehensive list of ALL technology roles across the entire industry. Include all technical specializations, levels, and domains."
    };
    
    console.log(`Requesting software engineering roles using ${MODEL_ID}...`);
    const result = await provider.suggestRoles(roleContext);

    if (!result.suggestions || result.suggestions.length === 0) {
      throw new Error('No suggestions returned from the model');
    }
    
    // Extract role titles from the suggestions
    let roles = result.suggestions.map(suggestion => suggestion.role);
    
    // We may need to make additional calls to get more comprehensive results
    // Create a list of tech domains to ensure coverage
    const techDomains = [
      'Data Science and Machine Learning',
      'Infrastructure and DevOps',
      'Product and Design',
      'Security and Compliance',
      'Hardware and IoT',
      'Mobile Development',
      'Management and Leadership',
      'Cloud and Architecture',
      'Frontend Development',
      'Backend Development',
      'Quality Assurance and Testing'
    ];
    
    // Make additional calls for each domain to ensure comprehensive coverage
    for (const domain of techDomains) {
      try {
        console.log(`Fetching roles for ${domain}...`);
        const domainContext = {
          ...roleContext,
          additionalContext: `Focus specifically on ${domain} roles across all tech companies. Include all levels from junior to principal/distinguished.`
        };
        
        const domainResult = await provider.suggestRoles(domainContext);
        if (domainResult.suggestions?.length > 0) {
          const domainRoles = domainResult.suggestions.map(s => s.role);
          console.log(`Found ${domainRoles.length} roles for ${domain}`);  
          roles = [...roles, ...domainRoles];
        }
      } catch (error) {
        console.error(`Error fetching ${domain} roles:`, error);
      }
    }
    
    // Deduplicate roles (case insensitive)
    let uniqueRoles = Array.from(new Set(
      roles.map(role => role.toLowerCase())
    )).map(lowerRole => {
      // Find the first occurrence with the original capitalization
      return roles.find(r => r.toLowerCase() === lowerRole) || lowerRole;
    });
    
    console.log(`After deduplication: ${uniqueRoles.length} unique roles found`);
    
    // Add some additional common roles that might be missing
    const additionalRoles = [
      // Technical Leadership
      'Chief Technology Officer (CTO)',
      'Chief Information Officer (CIO)', 
      'Chief Data Officer (CDO)',
      'Chief Security Officer (CSO)',
      'Chief Product Officer (CPO)',
      'VP of Engineering',
      'VP of Data Science',
      'VP of Product',
      'Director of Engineering',
      
      // Engineering Levels
      'Junior Software Engineer',
      'Software Engineer I',
      'Software Engineer II',
      'Senior Software Engineer',
      'Staff Software Engineer',
      'Principal Software Engineer',
      'Distinguished Engineer',
      'Fellow',
      
      // Specialized Engineering
      'Machine Learning Engineer',
      'AI Research Scientist',
      'Deep Learning Engineer',
      'MLOps Engineer',
      'Computer Vision Engineer',
      'NLP Engineer',
      'Data Engineer',
      'Database Administrator',
      'Database Engineer',
      
      // DevOps & SRE
      'DevOps Engineer',
      'Site Reliability Engineer (SRE)',
      'Platform Engineer',
      'Cloud Engineer',
      'Infrastructure Engineer',
      'System Administrator',
      'Network Engineer',
      'Release Engineer',
      
      // Security
      'Security Engineer',
      'Penetration Tester',
      'Security Analyst',
      'Security Architect',
      'Application Security Engineer',
      'Cryptography Engineer',
      
      // Web & Mobile
      'Frontend Engineer',
      'Backend Engineer',
      'Full Stack Engineer',
      'Mobile Engineer',
      'iOS Developer',
      'Android Developer',
      'React Native Developer',
      'Flutter Developer',
      'Web Developer',
      
      // Product & Design
      'Product Manager',
      'Senior Product Manager',
      'Product Designer',
      'UX Designer',
      'UI Designer',
      'UX Researcher',
      'Technical Program Manager',
      
      // QA & Testing
      'Quality Assurance Engineer',
      'Test Automation Engineer',
      'Manual QA Tester',
      'SDET (Software Development Engineer in Test)',
      'QA Analyst',
      'Test Lead',
      'Performance Test Engineer',
      'Security Test Engineer',
      
      // Emerging Tech
      'AR/VR Engineer',
      'Blockchain Developer',
      'Quantum Computing Engineer',
      'Robotics Engineer',
      'IoT Engineer',
      
      // Hardware
      'Hardware Engineer',
      'FPGA Engineer',
      'ASIC Designer',
      'Embedded Systems Engineer',
      'Firmware Engineer'
    ];
    
    // Add additional roles if they're not already in the list
    for (const role of additionalRoles) {
      if (!uniqueRoles.some(r => r.toLowerCase() === role.toLowerCase())) {
        uniqueRoles.push(role);
      }
    }
    
    // Sort alphabetically for better readability
    uniqueRoles.sort();
      
    return uniqueRoles;
  } catch (error) {
    console.error('Error fetching roles:', error);
    return [];
  }
}

/**
 * Save roles to a text file
 */
function saveToFile(roles: string[]): void {
  const timestamp = new Date().toISOString();
  const content = `# Comprehensive Technology Roles\n# Generated on ${timestamp}\n\n${roles.join('\n')}`;
  
  fs.writeFileSync(OUTPUT_FILE, content, 'utf-8');
  console.log(`Saved ${roles.length} roles to ${OUTPUT_FILE}`);
}

/**
 * Main execution function
 */
async function main() {
  try {
    const roles = await fetchTechRoles();
    
    if (roles.length === 0) {
      console.error('No roles were returned from the model');
      process.exit(1);
    }
    
    console.log(`Retrieved ${roles.length} software engineering roles`);
    saveToFile(roles);
  } catch (error) {
    console.error('Error in execution:', error);
    process.exit(1);
  }
}

// Run the script
main();
