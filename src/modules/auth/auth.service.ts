import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { Request } from 'express'
import prisma from '../../lib/prisma'
import { AppError } from '../../lib/AppError'
import { CreateUserInput, LoginInput, UpdateUserInput, UpdateFirmInput } from './auth.schema'
import { logger } from '../../lib/logger'
import { writeAuditLog } from '../audit/audit.service'

// Helper to derive cookie maxAge from JWT_EXPIRES_IN env var
function getJwtExpiresIn(): string {
  return process.env.JWT_EXPIRES_IN ?? '7d'
}

function jwtExpiresInToMs(expiresIn: string): number {
  const match = /^(\d+)([smhd])$/.exec(expiresIn)
  if (!match) return 7 * 24 * 60 * 60 * 1000 // default 7d
  const value = parseInt(match[1] ?? '0')
  const unit = match[2]
  switch (unit) {
    case 's': return value * 1000
    case 'm': return value * 60 * 1000
    case 'h': return value * 60 * 60 * 1000
    case 'd': return value * 24 * 60 * 60 * 1000
    default: return 7 * 24 * 60 * 60 * 1000
  }
}

export function getCookieMaxAge(): number {
  return jwtExpiresInToMs(getJwtExpiresIn())
}

// ── GET AUTH USER ────────────────────────────────────────────────────────────

export const getAuthUser = async (req: Request) => {
  const cookie = req.cookies?.auth_token as string | undefined
  if (!cookie) throw new AppError('Authorization cookie missing', 401)

  const jwtSecret = process.env.JWT_SECRET
  if (!jwtSecret) throw new AppError('Server misconfiguration', 500)

  try {
    const decoded = jwt.verify(cookie, jwtSecret) as { userId: string }
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        role: true,
        name: true,
        email: true,
        isActive: true,
        firmName: true,
      },
    })
    if (!user || !user.isActive) throw new AppError('User not found or inactive', 401)
    return user
  } catch (err) {
    if (err instanceof AppError) throw err
    throw new AppError('Invalid token', 401)
  }
}

// ── LOGIN ────────────────────────────────────────────────────────────────────

export const loginUser = async (input: LoginInput) => {
  const user = await prisma.user.findUnique({ where: { email: input.email } })

  if (!user || !user.isActive) throw new AppError('Invalid credentials', 401)

  const isPasswordValid = await bcrypt.compare(input.password, user.passwordHash)
  if (!isPasswordValid) throw new AppError('Invalid credentials', 401)

  const jwtSecret = process.env.JWT_SECRET
  if (!jwtSecret) throw new AppError('Server misconfiguration', 500)

  const token = jwt.sign({ userId: user.id, role: user.role }, jwtSecret, {
    expiresIn: getJwtExpiresIn() as jwt.SignOptions['expiresIn'],
  })

  writeAuditLog({
    userId: user.id,
    action: 'USER_LOGIN',
    entity: 'User',
    entityId: user.id,
  })

  logger.info({ userId: user.id }, 'User logged in')

  return {
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      firmName: user.firmName,
    },
  }
}

// ── CREATE USER ──────────────────────────────────────────────────────────────

export const createUser = async (input: CreateUserInput, requestingUserId?: string) => {
  const existing = await prisma.user.findFirst({
    where: { OR: [{ email: input.email }, { mobile: input.mobile }] },
  })
  if (existing) throw new AppError('User with this email or mobile already exists', 409)

  const passwordHash = await bcrypt.hash(input.password, 12)

  const user = await prisma.user.create({
    data: {
      name: input.name,
      email: input.email,
      mobile: input.mobile,
      passwordHash,
      role: input.role,
    },
    select: {
      id: true,
      name: true,
      email: true,
      mobile: true,
      role: true,
      isActive: true,
      createdAt: true,
    },
  })

  writeAuditLog({
    userId: requestingUserId,
    action: 'USER_CREATED',
    entity: 'User',
    entityId: user.id,
    meta: { email: user.email, role: user.role },
  })

  logger.info({ userId: user.id }, 'User created')
  return user
}

// ── UPDATE USER ──────────────────────────────────────────────────────────────

export const updateUser = async (
  userId: string,
  input: UpdateUserInput,
  requestingUserId?: string
) => {
  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (!user) throw new AppError('User not found', 404)

  if (input.mobile) {
    const mobileExists = await prisma.user.findFirst({
      where: { mobile: input.mobile, NOT: { id: userId } },
    })
    if (mobileExists) throw new AppError('Mobile number already in use', 409)
  }

  const updated = await prisma.user.update({
    where: { id: userId },
    data: input,
    select: {
      id: true,
      name: true,
      email: true,
      mobile: true,
      role: true,
      isActive: true,
      updatedAt: true,
    },
  })

  writeAuditLog({
    userId: requestingUserId,
    action: 'USER_UPDATED',
    entity: 'User',
    entityId: userId,
    meta: { changes: input as Record<string, string | undefined> },
  })

  logger.info({ userId }, 'User updated')
  return updated
}

// ── UPDATE FIRM SETTINGS ─────────────────────────────────────────────────────

export const updateFirmSettings = async (userId: string, input: UpdateFirmInput) => {
  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (!user) throw new AppError('User not found', 404)

  const updated = await prisma.user.update({
    where: { id: userId },
    data: input,
    select: {
      id: true,
      name: true,
      email: true,
      firmName: true,
      firmAddress: true,
      firmPhone: true,
    },
  })

  logger.info({ userId }, 'Firm settings updated')
  return updated
}

// ── TOGGLE ACTIVE ────────────────────────────────────────────────────────────

export const toggleUserActive = async (userId: string, requestingUserId?: string) => {
  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (!user) throw new AppError('User not found', 404)

  const updated = await prisma.user.update({
    where: { id: userId },
    data: { isActive: !user.isActive },
    select: { id: true, isActive: true },
  })

  writeAuditLog({
    userId: requestingUserId,
    action: 'USER_TOGGLED',
    entity: 'User',
    entityId: userId,
    meta: { isActive: updated.isActive },
  })

  logger.info({ userId, isActive: updated.isActive }, 'User active status toggled')
  return updated
}

// ── DELETE USER ──────────────────────────────────────────────────────────────

export const deleteUser = async (userId: string, requestingUserId?: string) => {
  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (!user) throw new AppError('User not found', 404)

  await prisma.user.delete({ where: { id: userId } })

  writeAuditLog({
    userId: requestingUserId,
    action: 'USER_DELETED',
    entity: 'User',
    entityId: userId,
    meta: { email: user.email },
  })

  logger.info({ userId }, 'User deleted')
  return { message: 'User deleted successfully' }
}

// ── GET ALL USERS ────────────────────────────────────────────────────────────

export const getAllUsers = async () => {
  return prisma.user.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      mobile: true,
      role: true,
      isActive: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
  })
}
