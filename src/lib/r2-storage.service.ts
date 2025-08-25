import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'

function mimeToExt(mime: string): string {
  const m = mime.toLowerCase()
  if (m.includes('image/png')) return 'png'
  if (m.includes('image/jpeg') || m.includes('image/jpg')) return 'jpg'
  if (m.includes('image/svg')) return 'svg'
  if (m.includes('image/webp')) return 'webp'
  if (m.includes('image/x-icon') || m.includes('image/vnd.microsoft.icon')) return 'ico'
  if (m.includes('image/gif')) return 'gif'
  return 'bin'
}

function parseBase64DataUrl(dataUrl: string): { mime: string; buffer: Buffer } | null {
  const match = /^data:([^;]+);base64,(.*)$/i.exec(dataUrl)
  if (!match) return null
  const mime = match[1]
  const data = match[2]
  try {
    return { mime, buffer: Buffer.from(data, 'base64') }
  } catch {
    return null
  }
}

@Injectable()
export class R2StorageService {
  private readonly client: S3Client
  private readonly bucket: string
  private readonly accountId: string
  private readonly publicBaseUrl?: string

  constructor(private readonly config: ConfigService) {
    this.accountId = this.config.get<string>('CLOUDFLARE_ACCOUNT_ID') || ''
    const accessKeyId = this.config.get<string>('R2_ACCESS_KEY_ID') || ''
    const secretAccessKey = this.config.get<string>('R2_SECRET_ACCESS_KEY') || ''
    this.bucket = this.config.get<string>('R2_BUCKET') || 'logos'
    this.publicBaseUrl = this.config.get<string>('R2_PUBLIC_BASE_URL') || undefined

    if (!this.accountId || !accessKeyId || !secretAccessKey) {
      throw new Error('R2StorageService: Missing CLOUDFLARE_ACCOUNT_ID or R2_ACCESS_KEY_ID/R2_SECRET_ACCESS_KEY')
    }

    this.client = new S3Client({
      region: 'auto',
      endpoint: `https://${this.accountId}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId, secretAccessKey },
      forcePathStyle: true,
    })
  }

  private buildPublicUrl(key: string): string {
    if (this.publicBaseUrl) {
      return `${this.publicBaseUrl.replace(/\/$/, '')}/${key}`
    }
    // Default public path style URL. Ensure your bucket policy allows public GET.
    return `https://${this.accountId}.r2.cloudflarestorage.com/${this.bucket}/${key}`
  }

  async uploadBase64Image(base64DataUrl: string, keyPrefix: string): Promise<string> {
    const parsed = parseBase64DataUrl(base64DataUrl)
    if (!parsed) throw new Error('Invalid base64 data URL')
    const { mime, buffer } = parsed
    const ext = mimeToExt(mime)

    const safePrefix = keyPrefix
      .replace(/[^a-zA-Z0-9/_.-]/g, '_')
      .replace(/_{2,}/g, '_')
      .replace(/\/{2,}/g, '/') // collapse double slashes
    const key = `${safePrefix}.${ext}`

    try {
      await this.client.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: key,
          Body: buffer,
          ContentType: mime,
          CacheControl: 'public, max-age=2592000, s-maxage=2592000', // 30 days
          ContentDisposition: 'inline',
        })
      )
    } catch (err: any) {
      if (err?.name === 'NoSuchBucket') {
        throw new Error(
          `R2 upload failed: bucket "${this.bucket}" not found in account ${this.accountId}. ` +
            `Verify the bucket exists in Cloudflare R2 and that R2_BUCKET is set correctly.`
        )
      }
      throw err
    }

    return this.buildPublicUrl(key)
  }
}
