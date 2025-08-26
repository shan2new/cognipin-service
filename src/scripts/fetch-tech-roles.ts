import * as fs from 'fs';
import * as path from 'path';
import { config } from 'dotenv';
import OpenAI from 'openai';

// Load environment variables
config();

// Configuration
const MODEL_ID = 'meta-llama/llama-3.2-3b-instruct:online';
const OUTPUT_FILE = path.join(__dirname, '../../tech-roles.txt');

// Initialize OpenAI client with OpenRouter configuration
const openRouterApiKey = process.env.OPENROUTER_API_KEY;

if (!openRouterApiKey) {
  console.error('Error: OPENROUTER_API_KEY is required in .env file');
  process.exit(1);
}

const openai = new OpenAI({
  apiKey: openRouterApiKey,
  baseURL: 'https://openrouter.ai/api/v1',
  defaultHeaders: {
    'HTTP-Referer': 'https://cognipin.com',
    'X-Title': 'Cognipin Service'
  },
  defaultQuery: { transforms: 'middle-out' }
});

/**
 * Fetch comprehensive tech roles using LLM
 */
async function fetchTechRoles(): Promise<string[]> {
  console.log(`Fetching comprehensive tech roles using OpenRouter...`);
  
  const systemPrompt = `
    You are a comprehensive career database for the technology industry with expertise in how major tech companies structure their engineering ladders and job titles.
    Provide an exhaustive list of ALL technology-related job titles and roles found across major tech companies.
    Format your response as a plain list with one role per line.
    
    CRITICAL: Include company-specific role names with their level designations, such as:
    - Amazon's SDE1, SDE2, SDE3, Principal SDE, etc.
    - Google's L3 Software Engineer, L4 Software Engineer, L5 Senior Software Engineer, L6 Staff Software Engineer, etc.
    - Microsoft's SDE, SDE II, Senior SDE, Principal SDE, etc.
    - Meta's E3 Software Engineer, E4 Software Engineer, E5 Senior Software Engineer, E6 Staff Software Engineer, etc.
    - Apple's ICT2, ICT3, ICT4, ICT5, ICT6, etc.
    
    Include ALL of the following categories with their COMPLETE level hierarchies:
    - Software Development (ALL levels, specializations, and frameworks) - include junior, mid-level, senior, staff, principal, distinguished, fellow levels
    - Quality Assurance and Testing (all types and levels)
    - DevOps, SRE, and Platform Engineering (all levels)
    - Data Science, Analytics, and Business Intelligence (all levels)
    - Machine Learning and AI roles (all levels and specializations)
    - Product Management and Product Design (all levels)
    - UX/UI Design and Research (all levels)
    - Technical Writing and Documentation (all levels)
    - Technical Support and Customer Success Engineering (all levels)
    - IT, Security, and Compliance (all levels)
    - Engineering Management (all levels - EM1, EM2, Director, Senior Director, VP, etc.)
    - Technical Program Management (all levels)
    - Hardware Engineering and IoT (all levels)
    - Cloud Engineering and Architecture (all levels)
    - Database Administration and Engineering (all levels)
    - Network Engineering (all levels)
    - Mobile Development (all platforms and levels)
    - Game Development (all levels)
    - Blockchain and Web3 (all levels)
    - AR/VR Development (all levels)
    - Quantum Computing (all levels)
    
    Be extremely thorough and include both common and company-specific nomenclature for roles.
    Each major tech company has their own leveling system - ensure you capture these differences.
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
    
    CRITICALLY IMPORTANT: Include company-specific role naming conventions and level designations such as:
    - Amazon: SDE1, SDE2, SDE3, Senior SDE, Principal SDE, etc.
    - Google: L3 Software Engineer, L4 Software Engineer, L5 Senior Software Engineer, L6 Staff Software Engineer, etc.
    - Microsoft: SDE, SDE II, Senior SDE, Principal SDE, Partner SDE, Distinguished Engineer, Technical Fellow, etc.
    - Meta/Facebook: E3 Software Engineer, E4 Software Engineer, E5 Senior Software Engineer, E6 Staff Software Engineer, etc.
    - Apple: ICT2, ICT3, ICT4, ICT5, ICT6, etc.
    
    Include ALL technical roles with their COMPLETE hierarchical progression, from entry-level to executive positions.
    Include highly specialized positions that might exist only at certain companies.
    Format as a simple list with ONLY the job titles, one per line, with no additional text.
    Be extremely thorough and include at least 300+ unique role titles with their proper level designations.
  `;

  try {
    // Collect roles from multiple domains to ensure comprehensive coverage
    const allRoles: string[] = [];

    // Make the initial call for general tech roles
    const initialResponse = await openai.chat.completions.create({
      model: MODEL_ID,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.2,
      max_tokens: 2048
    });
    
    const content = initialResponse.choices[0]?.message?.content || '';
    const initialRoles = parseRolesFromContent(content);
    allRoles.push(...initialRoles);
    console.log(`Initial fetch: ${initialRoles.length} roles`);
    
    // Tech domains to ensure comprehensive coverage
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
    
    // Make additional calls for each domain
    for (const domain of techDomains) {
      try {
        console.log(`Fetching roles for ${domain}...`);
        
        const domainPrompt = `
          Generate a comprehensive list of ONLY ${domain} roles that exist across major tech companies.
          Format as a simple list with ONLY the job titles, one per line, with no additional text.
          Include entry-level to executive positions and specialized roles in this domain.
        `;
        
        const domainResponse = await openai.chat.completions.create({
          model: MODEL_ID,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: domainPrompt }
          ],
          temperature: 0.3,
          max_tokens: 2048
        });
        
        const domainContent = domainResponse.choices[0]?.message?.content || '';
        const domainRoles = parseRolesFromContent(domainContent);
        console.log(`Found ${domainRoles.length} roles for ${domain}`);
        allRoles.push(...domainRoles);
      } catch (error) {
        console.error(`Error fetching ${domain} roles:`, error);
      }
    }
    
    // Add predefined roles that might be missing
    const additionalRoles = getAdditionalRoles();
    allRoles.push(...additionalRoles);
    
    // Deduplicate roles (case insensitive)
    const uniqueRolesMap = new Map<string, string>();
    for (const role of allRoles) {
      if (role.trim()) {
        uniqueRolesMap.set(role.toLowerCase(), role);
      }
    }
    
    const uniqueRoles = Array.from(uniqueRolesMap.values());
    console.log(`After deduplication: ${uniqueRoles.length} unique roles found`);
    
    // Sort alphabetically for better readability
    uniqueRoles.sort();
    
    return uniqueRoles;
  } catch (error) {
    console.error('Error fetching roles:', error);
    return [];
  }
}

/**
 * Parse roles from LLM response content
 */
function parseRolesFromContent(content: string): string[] {
  return content
    .split('\n')
    .map((line: string) => line.trim())
    .filter((line: string) => line && !line.startsWith('#') && !line.startsWith('-'))
    .map((line: string) => {
      // Clean up any prefixing numbers, bullets, etc.
      return line
        .replace(/^\d+\.\s*/, '') // Remove numbering (1., 2., etc.)
        .replace(/^[\u2022\-\u2013\u2014*]\s*/, '') // Remove bullets (\u2022, -, \u2013, \u2014, *)
        .trim();
    });
}

/**
 * Returns a list of additional roles that might be missing from LLM outputs
 */
function getAdditionalRoles(): string[] {
  return [
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
    'Senior Director of Engineering',
    'Director of Product',
    'Senior Director of Product',
    'Engineering Manager',
    'Senior Engineering Manager',
    'Technical Director',
    'Principal Architect',
    'Chief Architect',
    'Distinguished Architect',
    
    // Amazon Engineering Levels
    'SDE I',
    'SDE II',
    'SDE III',
    'SDE1',
    'SDE2',
    'SDE3',
    'Senior SDE',
    'Principal SDE',
    'Senior Principal SDE',
    'Distinguished Engineer (Amazon)',
    'Amazon Technical Fellow',
    
    // Google Engineering Levels
    'L3 Software Engineer',
    'L4 Software Engineer',
    'L5 Senior Software Engineer',
    'L6 Staff Software Engineer',
    'L7 Senior Staff Software Engineer',
    'L8 Principal Engineer',
    'L9 Distinguished Engineer',
    'L10 Google Fellow',
    'L11 Senior Google Fellow',
    
    // Microsoft Engineering Levels
    'SDE',
    'SDE II',
    'Senior SDE',
    'Principal SDE',
    'Partner SDE',
    'Distinguished Engineer (Microsoft)',
    'Technical Fellow (Microsoft)',
    'Senior Technical Fellow',
    
    // Meta/Facebook Engineering Levels
    'E3 Software Engineer',
    'E4 Software Engineer',
    'E5 Senior Software Engineer',
    'E6 Staff Software Engineer',
    'E7 Senior Staff Software Engineer',
    'E8 Principal Engineer',
    'E9 Distinguished Engineer',
    
    // Apple Engineering Levels
    'ICT2',
    'ICT3',
    'ICT4',
    'ICT5',
    'ICT6',
    'Principal Engineer (Apple)',
    
    // Other Common Engineering Levels
    'Junior Software Engineer',
    'Associate Software Engineer',
    'Software Engineer I',
    'Software Engineer II',
    'Software Engineer III',
    'Software Engineer IV',
    'Software Engineer V',
    'Mid-level Software Engineer',
    'Senior Software Engineer',
    'Lead Software Engineer',
    'Staff Software Engineer',
    'Senior Staff Software Engineer',
    'Principal Software Engineer',
    'Senior Principal Software Engineer',
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
    'Quantitative Analyst',
    'Algorithm Engineer',
    'Search Engine Engineer',
    'Compiler Engineer',
    'Operating Systems Engineer',
    
    // DevOps & SRE
    'DevOps Engineer',
    'Site Reliability Engineer (SRE)',
    'Platform Engineer',
    'Cloud Engineer',
    'Infrastructure Engineer',
    'System Administrator',
    'Network Engineer',
    'Release Engineer',
    'Configuration Manager',
    'Automation Engineer',
    'Chaos Engineer',
    
    // Security
    'Security Engineer',
    'Penetration Tester',
    'Security Analyst',
    'Security Architect',
    'Application Security Engineer',
    'Cryptography Engineer',
    'Threat Intelligence Analyst',
    'Security Operations Engineer',
    'Identity and Access Management Specialist',
    'Compliance Officer',
    
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
    'UI Developer',
    'JavaScript Engineer',
    'React Developer',
    'Angular Developer',
    'Vue.js Developer',
    'Node.js Developer',
    
    // Product & Design
    'Product Manager',
    'Senior Product Manager',
    'Associate Product Manager',
    'Product Designer',
    'UX Designer',
    'UI Designer',
    'UX Researcher',
    'Technical Program Manager',
    'Product Marketing Manager',
    'Growth Product Manager',
    'Product Analyst',
    
    // QA & Testing
    'Quality Assurance Engineer',
    'Test Automation Engineer',
    'Manual QA Tester',
    'SDET (Software Development Engineer in Test)',
    'QA Analyst',
    'Test Lead',
    'Performance Test Engineer',
    'Security Test Engineer',
    'Accessibility Tester',
    'Test Architect',
    
    // Emerging Tech
    'AR/VR Engineer',
    'Blockchain Developer',
    'Quantum Computing Engineer',
    'Robotics Engineer',
    'IoT Engineer',
    'Autonomous Vehicle Engineer',
    'Drone Engineer',
    'Computer Graphics Engineer',
    'Game Engine Developer',
    '3D Modeling Engineer',
    'Haptics Engineer',
    
    // Hardware
    'Hardware Engineer',
    'FPGA Engineer',
    'ASIC Designer',
    'Embedded Systems Engineer',
    'Firmware Engineer',
    'PCB Designer',
    'IC Design Engineer',
    'RF Engineer',
    'Power Electronics Engineer',
    'VLSI Engineer',
    'Systems Engineer',
    
    // Data
    'Data Scientist',
    'Data Analyst',
    'Business Intelligence Developer',
    'Big Data Engineer',
    'Data Architect',
    'Data Visualization Engineer',
    'ETL Developer',
    'Analytics Engineer',
    'Research Scientist',
    'Statistician',
    
    // Specialized IT
    'Cloud Architect',
    'Solutions Architect',
    'Enterprise Architect',
    'Technical Account Manager',
    'Customer Success Engineer',
    'Developer Advocate',
    'Developer Relations',
    'Technical Evangelist',
    'Documentation Engineer',
    'Technical Writer'
  ];
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
    
    console.log(`Retrieved ${roles.length} technology roles`);
    saveToFile(roles);
  } catch (error) {
    console.error('Error in execution:', error);
    process.exit(1);
  }
}

// Execute the main function
main();
