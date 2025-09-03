import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { UserAutofillState } from '../../schema/autofill-state.entity'

@Injectable()
export class AutofillService {
  constructor(
    @InjectRepository(UserAutofillState) private readonly repo: Repository<UserAutofillState>,
  ) {}

  async get(userId: string): Promise<UserAutofillState> {
    let row = await this.repo.findOne({ where: { user_id: userId } })
    if (!row) {
      row = this.repo.create({ user_id: userId, state: {} })
      await this.repo.save(row)
    }
    return row
  }

  async update(userId: string, state: any): Promise<UserAutofillState> {
    const row = await this.get(userId)
    row.state = state || {}
    await this.repo.save(row)
    return row
  }
}


