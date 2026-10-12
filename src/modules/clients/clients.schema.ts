import { z } from 'zod'

const phoneRegex = /^\+?[1-9]\d{9,14}$/

export const CreateClientSchema = z.object({
  name: z.string().trim().min(2, 'Client name must be at least 2 characters'),
  phone: z.string().trim().regex(phoneRegex, 'Invalid phone number; must be in E.164 format (e.g. +919876543210)'),
  matterType: z.string().trim().min(1, 'Matter type is required'),
  details: z.record(z.unknown()).default({}),
  keyDate: z.string().datetime().optional().nullable(),
  keyDateLabel: z.string().trim().optional().nullable(),
})

export type CreateClientInput = z.infer<typeof CreateClientSchema>

export const UpdateClientSchema = z.object({
  name: z.string().trim().min(2).optional(),
  phone: z.string().trim().regex(phoneRegex).optional(),
  matterType: z.string().trim().min(1).optional(),
  details: z.record(z.unknown()).optional(),
  keyDate: z.string().datetime().optional().nullable(),
  keyDateLabel: z.string().trim().optional().nullable(),
  isBilled: z.boolean().optional(),
})

export type UpdateClientInput = z.infer<typeof UpdateClientSchema>

export const UpdateScratchpadSchema = z.object({
  scratchpad: z.string().default(''),
})

export type UpdateScratchpadInput = z.infer<typeof UpdateScratchpadSchema>

export const RequirementItemSchema = z.object({
  id: z.string().optional(),
  label: z.string().trim().min(1, 'Requirement label is required'),
  category: z.string().trim().min(1, 'Category is required'),
  isRequired: z.boolean().default(true),
  sortOrder: z.number().int().default(0),
})

export const UpdateRequirementsSchema = z.object({
  requirements: z.array(RequirementItemSchema),
})

export type UpdateRequirementsInput = z.infer<typeof UpdateRequirementsSchema>
