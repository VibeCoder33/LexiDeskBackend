import prisma from '../../lib/prisma'
import { AppError } from '../../lib/AppError'
import { storageService } from '../../lib/storage'
import { writeAuditLog } from '../audit/audit.service'
import { recomputeClientStatus } from '../clients/clients.service'
import { UpdateDocumentInput } from './documents.schema'
import { Prisma } from '../../generated/prisma/client'

export async function getDocumentPreviewUrl(userId: string, documentId: string) {
  const document = await prisma.document.findFirst({
    where: { id: documentId, ownerId: userId },
  })

  if (!document) {
    throw new AppError('Document not found', 404)
  }

  // Stamp reviewedAt on preview if not already reviewed
  if (!document.reviewedAt) {
    await prisma.document.update({
      where: { id: documentId },
      data: { reviewedAt: new Date() },
    })
    await recomputeClientStatus(document.clientId)

    writeAuditLog({
      userId,
      action: 'DOCUMENT_REVIEWED',
      entity: 'Document',
      entityId: documentId,
      meta: { fileName: document.fileName },
    })
  }

  const previewUrl = await storageService.getPresignedDownloadUrl(
    document.s3Key,
    document.fileName
  )

  return {
    documentId,
    fileName: document.fileName,
    mimeType: document.mimeType,
    previewUrl,
  }
}

export async function updateDocument(
  userId: string,
  documentId: string,
  input: UpdateDocumentInput
) {
  const document = await prisma.document.findFirst({
    where: { id: documentId, ownerId: userId },
  })

  if (!document) {
    throw new AppError('Document not found', 404)
  }

  const data: Prisma.DocumentUpdateInput = {}
  if (input.category !== undefined) data.category = input.category
  if (input.verification !== undefined) data.verification = input.verification
  if (input.verificationNote !== undefined) data.verificationNote = input.verificationNote
  if (input.requirementId !== undefined) {
    data.requirement = input.requirementId
      ? { connect: { id: input.requirementId } }
      : { disconnect: true }
  }
  if (input.reviewed !== undefined) {
    data.reviewedAt = input.reviewed ? new Date() : null
  }

  const updated = await prisma.document.update({
    where: { id: documentId },
    data,
  })

  await recomputeClientStatus(document.clientId)

  writeAuditLog({
    userId,
    action: 'DOCUMENT_REVIEWED',
    entity: 'Document',
    entityId: documentId,
    meta: input as unknown as Prisma.InputJsonValue,
  })

  return updated
}

export async function deleteDocument(userId: string, documentId: string) {
  const document = await prisma.document.findFirst({
    where: { id: documentId, ownerId: userId },
  })

  if (!document) {
    throw new AppError('Document not found', 404)
  }

  await prisma.document.delete({
    where: { id: documentId },
  })

  await recomputeClientStatus(document.clientId)

  writeAuditLog({
    userId,
    action: 'DOCUMENT_DELETED',
    entity: 'Document',
    entityId: documentId,
    meta: { fileName: document.fileName, clientId: document.clientId },
  })

  return { message: 'Document deleted successfully' }
}
