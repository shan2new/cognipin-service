import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { Application } from '../schema/application.entity'
import { Conversation } from '../schema/conversation.entity'
import { InterviewRound } from '../schema/interview-round.entity'
import { StageHistory } from '../schema/stage-history.entity'

@Injectable()
export class ActivityService {
  constructor(
    @InjectRepository(Application) private readonly appRepo: Repository<Application>,
    @InjectRepository(Conversation) private readonly convRepo: Repository<Conversation>,
    @InjectRepository(InterviewRound) private readonly roundRepo: Repository<InterviewRound>,
    @InjectRepository(StageHistory) private readonly histRepo: Repository<StageHistory>,
  ) {}

  async recomputeLastActivity(applicationId: string): Promise<void> {
    const app = await this.appRepo.findOneOrFail({ where: { id: applicationId } })
    const [conv, hist, roundSched, roundComp] = await Promise.all([
      this.convRepo
        .createQueryBuilder('c')
        .select('MAX(c.occurred_at)', 'max')
        .where('c.application_id = :id', { id: applicationId })
        .getRawOne<{ max: Date | null }>(),
      this.histRepo
        .createQueryBuilder('h')
        .select('MAX(h.changed_at)', 'max')
        .where('h.application_id = :id', { id: applicationId })
        .getRawOne<{ max: Date | null }>(),
      this.roundRepo
        .createQueryBuilder('r')
        .select('MAX(r.scheduled_at)', 'max')
        .where('r.application_id = :id', { id: applicationId })
        .getRawOne<{ max: Date | null }>(),
      this.roundRepo
        .createQueryBuilder('r2')
        .select('MAX(r2.completed_at)', 'max')
        .where('r2.application_id = :id', { id: applicationId })
        .getRawOne<{ max: Date | null }>(),
    ])

    const dates = [app.created_at, conv?.max, hist?.max, roundSched?.max, roundComp?.max].filter(Boolean) as Date[]
    const latest = dates.reduce((acc, d) => (acc > d ? acc : d))
    if (app.last_activity_at.getTime() !== latest.getTime()) {
      app.last_activity_at = latest
      await this.appRepo.save(app)
    }
  }
}


