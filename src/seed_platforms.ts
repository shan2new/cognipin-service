import 'reflect-metadata'
import { AppDataSource } from './data-source'
import { EntitySchema, QueryRunner } from 'typeorm'

// Minimal inline entity to avoid coupling to future modules
interface Platform {
  id: string
  name: string
  url: string
  created_at: Date
  updated_at: Date
}

const PlatformEntity = new EntitySchema<Platform>({
  name: 'platform',
  columns: {
    id: { type: 'uuid', primary: true, generated: 'uuid' },
    name: { type: 'text' },
    url: { type: 'text', unique: true },
    created_at: { type: 'timestamptz', createDate: true },
    updated_at: { type: 'timestamptz', updateDate: true },
  },
})

const seedData: { name: string; url: string }[] = [
  { name: 'Instahyre', url: 'https://www.instahyre.com' },
  { name: 'LinkedIn', url: 'https://www.linkedin.com' },
  { name: 'TopHire', url: 'https://tophire.co' },
  { name: 'Cutshort', url: 'https://cutshort.io' },
  { name: 'Uplers', url: 'https://www.uplers.com' },
  { name: 'Other', url: 'https://example.com/other' },
]

async function upsertPlatform(qr: QueryRunner, name: string, url: string): Promise<void> {
  const existing = await qr.query('SELECT id FROM platform WHERE url = $1', [url])
  if (existing.length > 0) return
  await qr.query('INSERT INTO platform(name, url) VALUES ($1, $2)', [name, url])
}

async function main(): Promise<void> {
  await AppDataSource.initialize()
  const qr = AppDataSource.createQueryRunner()
  await qr.startTransaction()
  try {
    for (const s of seedData) {
      await upsertPlatform(qr, s.name, s.url)
    }
    await qr.commitTransaction()
    // eslint-disable-next-line no-console
    console.log('Seeded platforms (idempotent)')
  } catch (err) {
    await qr.rollbackTransaction()
    throw err
  } finally {
    await qr.release()
    await AppDataSource.destroy()
  }
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err)
  process.exit(1)
})


