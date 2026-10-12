import { z } from 'zod'

const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/heic',
  'image/webp',
]

const MAX_FILE_SIZE = 25 * 1024 * 1024 // 25 MB

export const PortalPresignSchema = z.object({
  fileName: z.string().trim().min(1, 'File name is required'),
  mimeType: z
    .string()
    .trim()
    .refine((val) => ALLOWED_MIME_TYPES.includes(val.toLowerCase()), {
      message: 'Invalid file format. Allowed formats: PDF, JPEG, PNG, HEIC, WebP',
    }),
  sizeBytes: z
    .number()
    .int()
    .positive('File size must be positive')
    .max(MAX_FILE_SIZE, 'File size must not exceed 25 MB'),
  requirementId: z.string().optional().nullable(),
})

export type PortalPresignInput = z.infer<typeof PortalPresignSchema>

export const PortalCompleteSchema = z.object({
  s3Key: z.string().trim().min(1, 'S3 key is required'),
  fileName: z.string().trim().min(1, 'File name is required'),
  mimeType: z.string().trim().min(1, 'Mime type is required'),
  sizeBytes: z.number().int().positive('File size must be positive'),
  requirementId: z.string().optional().nullable(),
})

export type PortalCompleteInput = z.infer<typeof PortalCompleteSchema>
