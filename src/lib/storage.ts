import crypto from 'crypto'
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { logger } from './logger'

export interface PresignUploadResult {
  uploadUrl: string
  s3Key: string
  headers: Record<string, string>
}

export interface StorageService {
  getPresignedUploadUrl(
    s3Key: string,
    mimeType: string,
    contentLength: number
  ): Promise<PresignUploadResult>
  getPresignedDownloadUrl(s3Key: string, fileName: string): Promise<string>
}

class AwsS3StorageService implements StorageService {
  private s3: S3Client
  private bucket: string

  constructor() {
    this.bucket = process.env.S3_BUCKET ?? 'lexidesk-documents'
    this.s3 = new S3Client({
      region: process.env.AWS_REGION ?? 'ap-south-1',
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID ?? 'mock-key',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? 'mock-secret',
      },
    })
  }

  async getPresignedUploadUrl(
    s3Key: string,
    mimeType: string,
    _contentLength: number
  ): Promise<PresignUploadResult> {
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: s3Key,
      ContentType: mimeType,
    })

    const uploadUrl = await getSignedUrl(this.s3, command, { expiresIn: 900 }) // 15 mins
    return {
      uploadUrl,
      s3Key,
      headers: {
        'Content-Type': mimeType,
      },
    }
  }

  async getPresignedDownloadUrl(s3Key: string, fileName: string): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: s3Key,
      ResponseContentDisposition: `inline; filename="${encodeURIComponent(fileName)}"`,
    })

    return getSignedUrl(this.s3, command, { expiresIn: 300 }) // 5 mins
  }
}

class LocalMockStorageService implements StorageService {
  async getPresignedUploadUrl(
    s3Key: string,
    mimeType: string,
    _contentLength: number
  ): Promise<PresignUploadResult> {
    const appUrl = process.env.PUBLIC_APP_URL ?? 'http://localhost:3001'
    return {
      uploadUrl: `${appUrl}/api/mock-upload?key=${encodeURIComponent(s3Key)}`,
      s3Key,
      headers: {
        'Content-Type': mimeType,
      },
    }
  }

  async getPresignedDownloadUrl(s3Key: string, fileName: string): Promise<string> {
    const appUrl = process.env.PUBLIC_APP_URL ?? 'http://localhost:3001'
    return `${appUrl}/api/mock-download?key=${encodeURIComponent(s3Key)}&name=${encodeURIComponent(fileName)}`
  }
}

const isAwsConfigured =
  process.env.S3_DRIVER !== 'local' &&
  Boolean(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY && process.env.S3_BUCKET)

export const storageService: StorageService = isAwsConfigured
  ? new AwsS3StorageService()
  : new LocalMockStorageService()

logger.info(
  { driver: isAwsConfigured ? 'AWS S3' : 'Local/Mock' },
  'Storage service initialized'
)

export function generateSafeS3Key(
  ownerId: string,
  clientId: string,
  fileName: string
): string {
  const uuid = crypto.randomUUID()
  const sanitized = fileName
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, '_')
    .slice(0, 80)
  return `owners/${ownerId}/clients/${clientId}/${uuid}-${sanitized}`
}
