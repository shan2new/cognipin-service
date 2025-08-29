import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common'
import { Queue, Worker, JobsOptions } from 'bullmq'
import { ConfigService } from '@nestjs/config'
import IORedis from 'ioredis'
import { GmailSyncService } from './gmail.sync.service'

type MailSyncJob = { userId: string; accountId: string }

@Injectable()
export class MailQueue implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger(MailQueue.name)
  private connection: IORedis
  private queue: Queue<MailSyncJob>
  private worker: Worker<MailSyncJob>

  constructor(private readonly config: ConfigService, private readonly sync: GmailSyncService) {
    this.connection = new IORedis(this.config.get<string>('REDIS_URL')!, {
      // BullMQ requirement
      maxRetriesPerRequest: null,
    })
    this.queue = new Queue<MailSyncJob>('mail_sync', { connection: this.connection })
    this.worker = new Worker<MailSyncJob>(
      'mail_sync',
      async (job) => {
        const { userId, accountId } = job.data
        const start = Date.now()
        this.log.log(`Job start [${job.id}] user=${userId} account=${accountId}`)
        try {
          const result = await this.sync.syncAccount(userId, accountId)
          const ms = Date.now() - start
          this.log.log(`Job complete [${job.id}] threads=${result.importedThreads} messages=${result.importedMessages} in ${ms}ms`)
          return result
        } catch (err: unknown) {
          const ms = Date.now() - start
          const e = err as Error
          this.log.error(`Job failed [${job.id}] after ${ms}ms`, e?.stack || String(err))
          throw err
        }
      },
      { connection: this.connection, concurrency: 3 },
    )

    this.worker.on('completed', (job, result: Record<string, unknown> | undefined) => {
      this.log.debug?.(`Worker completed [${job.id}] -> ${JSON.stringify(result || {})}`)
    })
    this.worker.on('failed', (job, err) => {
      this.log.warn(`Worker failed [${job?.id}] ${err?.message}`)
    })
    this.worker.on('error', (err) => {
      this.log.error(`Worker error ${err?.message}`)
    })
  }

  async onModuleInit() {
    this.log.log('MailQueue initialized and worker started')
  }

  async onModuleDestroy() {
    await this.worker.close()
    await this.queue.close()
    await this.connection.quit()
  }

  async enqueueSync(userId: string, accountId: string, opts?: JobsOptions) {
    const jobId = `sync:${accountId}`
    console.log('jobId', jobId)
    this.log.log(`Enqueue sync job user=${userId} account=${accountId} jobId=${jobId}`)
    // If an old completed/failed job exists with same id, remove it so we can enqueue a fresh one
    const existing = await this.queue.getJob(jobId)
    if (existing) {
      const state = await existing.getState().catch(() => undefined)
      if (state === 'active' || state === 'waiting' || state === 'delayed') {
        this.log.log(`Job already in progress state=${state} [${jobId}]`)
        return
      }
      await existing.remove().catch(() => undefined)
    }
    await this.queue.add('sync', { userId, accountId }, { jobId, removeOnComplete: 1000, removeOnFail: 1000, ...(opts || {}) })
  }

  async getStatus(accountId?: string): Promise<{ counts: Record<string, number>; job: { id: string; name: string; state?: string; timestamp: number; attemptsMade: number } | null }> {
    const counts = await this.queue.getJobCounts('wait', 'active', 'completed', 'failed', 'delayed', 'paused')
    let job: { id: string; name: string; state?: string; timestamp: number; attemptsMade: number } | null = null
    if (accountId) {
      const j = await this.queue.getJob(`sync:${accountId}`)
      if (j) {
        const state = await j.getState().catch(() => undefined)
        job = { id: j.id as string, name: j.name, state, timestamp: j.timestamp, attemptsMade: j.attemptsMade }
      }
    }
    return { counts, job }
  }
}


