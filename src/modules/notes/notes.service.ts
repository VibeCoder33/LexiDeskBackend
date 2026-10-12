import prisma from '../../lib/prisma'
import { AppError } from '../../lib/AppError'

export async function getNotes(userId: string, limit = 20) {
  return prisma.quickNote.findMany({
    where: { ownerId: userId },
    orderBy: { createdAt: 'desc' },
    take: Math.min(100, Math.max(1, limit)),
  })
}

export async function createNote(userId: string, body: string) {
  return prisma.quickNote.create({
    data: {
      ownerId: userId,
      body,
    },
  })
}

export async function deleteNote(userId: string, noteId: string) {
  const note = await prisma.quickNote.findFirst({
    where: { id: noteId, ownerId: userId },
  })

  if (!note) {
    throw new AppError('Note not found', 404)
  }

  await prisma.quickNote.delete({
    where: { id: noteId },
  })

  return { message: 'Note deleted successfully' }
}
