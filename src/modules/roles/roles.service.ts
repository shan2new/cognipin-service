import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { Role } from '../../schema/role.entity'
import { UserProfile } from '../../schema/user-profile.entity'

function normalize(text: string) {
  return text.toLowerCase().trim().replace(/\s+/g, ' ')
}

@Injectable()
export class RolesService {
  constructor(
    @InjectRepository(Role) private readonly roleRepo: Repository<Role>,
    @InjectRepository(UserProfile) private readonly profileRepo: Repository<UserProfile>,
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

    // Helper to run search with optional group filter
    const runSearch = async (gid?: string | null) => {
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
      const inGroup = await runSearch(groupId)
      if (inGroup.length) return inGroup
    }

    // 2) Fallback to global
    return runSearch(null)
  }
}
