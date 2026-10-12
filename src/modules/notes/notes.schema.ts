import { z } from 'zod'

export const CreateNoteSchema = z.object({
  body: z.string().trim().min(1, 'Note text cannot be empty'),
})

export type CreateNoteInput = z.infer<typeof CreateNoteSchema>
