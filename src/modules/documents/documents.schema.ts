import { z } from 'zod'

export const UpdateDocumentSchema = z.object({
  category: z.string().trim().optional(),
  verification: z.enum(['PENDING', 'VERIFIED', 'NEEDS_REVIEW']).optional(),
  verificationNote: z.string().trim().optional().nullable(),
  reviewed: z.boolean().optional(),
  requirementId: z.string().optional().nullable(),
})

export type UpdateDocumentInput = z.infer<typeof UpdateDocumentSchema>
