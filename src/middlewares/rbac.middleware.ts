import { Request, Response, NextFunction } from 'express'
import { AppError } from '../lib/AppError'
import { Role } from '../generated/prisma/enums'

export const requireRole =
  (...allowedRoles: Role[]) =>
  (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(new AppError('Unauthorized', 401))
      return
    }

    if (!allowedRoles.includes(req.user.role)) {
      next(new AppError('Forbidden — insufficient permissions', 403))
      return
    }

    next()
  }
