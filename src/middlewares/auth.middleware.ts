import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { AppError } from '../lib/AppError'
import { Role } from '../generated/prisma/enums'

export interface AuthPayload {
  userId: string
  role: Role
}

export const authenticate = (req: Request, _res: Response, next: NextFunction): void => {
  const jwtSecret = process.env.JWT_SECRET
  if (!jwtSecret) {
    next(new AppError('Server misconfiguration — JWT_SECRET missing', 500))
    return
  }

  const authCookie = req.cookies.auth_token as string | undefined
  if (!authCookie) {
    next(new AppError('Unauthorized', 401))
    return
  }

  try {
    const payload = jwt.verify(authCookie, jwtSecret) as AuthPayload
    req.user = payload
    next()
  } catch {
    next(new AppError('Unauthorized — invalid or expired token', 401))
  }
}
