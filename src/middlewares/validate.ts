import { Request, Response, NextFunction } from 'express'
import { ZodSchema, ZodError } from 'zod'

/**
 * Validate req.body against the given Zod schema.
 * On failure, responds with standardized: { error: string, details: Record<string, string[]> }
 */
export const validate =
  (schema: ZodSchema) =>
  (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body)
    if (!result.success) {
      const zodErr = result.error as ZodError
      const fieldErrors = zodErr.flatten().fieldErrors as Record<string, string[]>
      res.status(400).json({
        error: 'Validation failed',
        details: fieldErrors,
      })
      return
    }
    req.body = result.data
    next()
  }
