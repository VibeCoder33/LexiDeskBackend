import { Request, Response, NextFunction } from 'express'
import { AppError } from '../lib/AppError'
import { logger } from '../lib/logger'

export const errorHandler = (
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void => {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      error: err.message,
      ...(err.details ? { details: err.details } : {}),
    })
    return
  }

  // Never expose raw Prisma or internal errors to the client
  logger.error(err)
  res.status(500).json({ error: 'Internal server error' })
}
