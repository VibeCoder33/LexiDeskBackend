import prisma from '../../lib/prisma'

export interface SearchResultClient {
  id: string
  name: string
  matterType: string
  phone: string
  status: string
}

export interface SearchResultDocument {
  id: string
  fileName: string
  detectedType: string | null
  category: string
  clientId: string
  clientName: string
}

export interface OmniSearchResponse {
  clients: SearchResultClient[]
  documents: SearchResultDocument[]
}

export async function searchOmni(
  userId: string,
  rawQuery: string
): Promise<OmniSearchResponse> {
  const q = rawQuery.trim()
  if (q.length < 2) {
    return { clients: [], documents: [] }
  }

  const [clients, documents] = await Promise.all([
    prisma.client.findMany({
      where: {
        ownerId: userId,
        OR: [
          { name: { contains: q, mode: 'insensitive' } },
          { matterType: { contains: q, mode: 'insensitive' } },
          { phone: { contains: q, mode: 'insensitive' } },
        ],
      },
      take: 5,
      select: {
        id: true,
        name: true,
        matterType: true,
        phone: true,
        status: true,
      },
    }),
    prisma.document.findMany({
      where: {
        ownerId: userId,
        OR: [
          { fileName: { contains: q, mode: 'insensitive' } },
          { detectedType: { contains: q, mode: 'insensitive' } },
          { category: { contains: q, mode: 'insensitive' } },
        ],
      },
      take: 5,
      select: {
        id: true,
        fileName: true,
        detectedType: true,
        category: true,
        clientId: true,
        client: {
          select: { name: true },
        },
      },
    }),
  ])

  return {
    clients: clients.map((c) => ({
      id: c.id,
      name: c.name,
      matterType: c.matterType,
      phone: c.phone,
      status: c.status,
    })),
    documents: documents.map((d) => ({
      id: d.id,
      fileName: d.fileName,
      detectedType: d.detectedType,
      category: d.category,
      clientId: d.clientId,
      clientName: d.client.name,
    })),
  }
}
