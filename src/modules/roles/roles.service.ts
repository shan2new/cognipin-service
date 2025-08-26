import { Injectable, Logger } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { Role } from '../../schema/role.entity'
import { UserProfile } from '../../schema/user-profile.entity'
import { ElasticsearchService } from '../../lib/elasticsearch.service'

function normalize(text: string) {
  return text.toLowerCase().trim().replace(/\s+/g, ' ')
}

@Injectable()
export class RolesService {
  private readonly logger = new Logger('RolesService');
  private readonly ROLES_INDEX = 'roles';

  constructor(
    @InjectRepository(Role) private readonly roleRepo: Repository<Role>,
    @InjectRepository(UserProfile) private readonly profileRepo: Repository<UserProfile>,
    private readonly esService: ElasticsearchService,
  ) {}

  async search(userId: string, query: string, limit = 20) {
    const q = query.trim()
    const nq = normalize(q)

    // Get user's current role and group
    const profile = await this.profileRepo.findOne({
      where: { user_id: userId },
      relations: ['role', 'role.group'],
    })

    const groupId = profile?.role?.group ? (profile.role as any).group?.id : null

    try {
      // First try Elasticsearch search if it's available
      if (this.esService.isInitialized()) {
        // Create the Elasticsearch query
        const esQuery = {
          size: limit,
          query: {
            bool: {
              should: [
                // Match the title with high boost
                { match: { title: { query: q, boost: 3 } } },
                // Match the normalized title
                { match: { normalized_title: { query: nq, boost: 2 } } },
                // Match synonyms if available
                { match: { synonyms: { query: q, boost: 1 } } },
                // Fuzzy search for title with lower boost
                { fuzzy: { title: { value: q, boost: 0.5 } } }
              ],
              minimum_should_match: 1
            }
          },
          sort: [
            "_score",
            { title: { order: "asc" } }
          ]
        };

        // If we have a group ID, filter by it first
        if (groupId) {
          // Copy the query and add a filter for the group_id
          const groupFilteredQuery = {
            ...esQuery,
            query: {
              bool: {
                ...esQuery.query.bool,
                filter: [
                  { term: { group_id: groupId } }
                ]
              }
            }
          };

          // Try the group-filtered search first
          const groupResult = await this.esService.search<Role>(this.ROLES_INDEX, groupFilteredQuery);
          
          if (groupResult.hits.hits.length > 0) {
            // Return the roles from Elasticsearch
            return groupResult.hits.hits.map(hit => hit._source);
          }
        }

        // If group search returned no results or no group filter was applied, try global search
        const globalResult = await this.esService.search<Role>(this.ROLES_INDEX, esQuery);
        
        if (globalResult.hits.hits.length > 0) {
          // Return the roles from Elasticsearch
          return globalResult.hits.hits.map(hit => hit._source);
        }
        
        this.logger.debug(`Elasticsearch search returned no results for query: ${q}`);
      }
    } catch (error: any) {
      this.logger.error(`Elasticsearch search failed: ${error.message || 'Unknown error'}`, error.stack || '');
      // Continue to database fallback on error
    }
    
    // Fallback to database search if Elasticsearch is not available or returned no results
    this.logger.log(`Falling back to database search for query: ${q}`);
    
    // Helper to run search with optional group filter
    const runDatabaseSearch = async (gid?: string | null) => {
      const qb = this.roleRepo
        .createQueryBuilder('r')
        .where('(r.title ILIKE :q OR r.normalized_title ILIKE :nq)', { q: `%${q}%`, nq: `%${nq}%` })
        .orderBy('r.title', 'ASC')
        .limit(limit)

      if (gid) qb.andWhere('r.group_id = :gid', { gid })

      return qb.getMany()
    }

    // 1) Try within group first
    if (groupId) {
      const inGroup = await runDatabaseSearch(groupId)
      if (inGroup.length) return inGroup
    }

    // 2) Fallback to global
    return runDatabaseSearch(null)
  }
}
