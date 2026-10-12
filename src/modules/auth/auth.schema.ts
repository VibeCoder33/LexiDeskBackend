import { z } from 'zod'

const strongPassword = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number')
  .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character')

export const CreateUserSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  mobile: z.string().regex(/^\+?[0-9]{10,15}$/, 'Invalid mobile number'),
  password: strongPassword,
  role: z.enum(['SUPER', 'PROPERTY_LAWYER', 'LITIGATION_LAWYER', 'CA']).default('PROPERTY_LAWYER'),
})

export const LoginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
})

export const UpdateUserSchema = z.object({
  name: z.string().min(2).optional(),
  mobile: z
    .string()
    .regex(/^\+?[0-9]{10,15}$/, 'Invalid mobile number')
    .optional(),
  role: z.enum(['SUPER', 'PROPERTY_LAWYER', 'LITIGATION_LAWYER', 'CA']).optional(),
})

export const UpdateFirmSchema = z.object({
  firmName: z.string().min(1).optional(),
  firmAddress: z.string().optional(),
  firmPhone: z.string().optional(),
})

export type CreateUserInput = z.infer<typeof CreateUserSchema>
export type LoginInput = z.infer<typeof LoginSchema>
export type UpdateUserInput = z.infer<typeof UpdateUserSchema>
export type UpdateFirmInput = z.infer<typeof UpdateFirmSchema>
