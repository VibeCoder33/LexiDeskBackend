import prisma from '../../lib/prisma'
import { logger } from '../../lib/logger'
import { Prisma } from '../../generated/prisma/client'

// =============================
// AUDIT LOGGING SERVICE
// Fire-and-forget — never blocks the main operation
// =============================

type AuditAction =
  | 'USER_LOGIN'
  | 'USER_LOGOUT'
  | 'USER_CREATED'
  | 'USER_UPDATED'
  | 'USER_DELETED'
  | 'USER_TOGGLED'
  | 'CLIENT_CREATED'
  | 'CLIENT_UPDATED'
  | 'LINK_GENERATED'
  | 'LINK_REVOKED'
  | 'LINK_RESTORED'
  | 'DOCUMENT_UPLOADED'
  | 'DOCUMENT_DELETED'
  | 'DOCUMENT_REVIEWED'
  | 'NUDGE_SENT'

interface AuditParams {
  userId?: string
  action: AuditAction
  entity: string
  entityId?: string
  meta?: Prisma.InputJsonValue
}

export const writeAuditLog = (params: AuditParams): void => {
  prisma.auditLog
    .create({
      data: {
        userId: params.userId ?? null,
        action: params.action,
        entity: params.entity,
        entityId: params.entityId ?? null,
        meta: params.meta ?? undefined,
      },
    })
    .catch((err: Error) => {
      logger.error({ err, params }, 'Audit log write failed')
    })
}
