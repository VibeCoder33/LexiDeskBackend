import 'dotenv/config'
import { Pool } from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../generated/prisma/client'
import { logger } from './logger'

const prismaClientSingleton = () => {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
    options: '-c timezone=UTC',
  })

  const adapter = new PrismaPg(pool)
  return new PrismaClient({ adapter })
}

type PrismaClientSingleton = ReturnType<typeof prismaClientSingleton>

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClientSingleton | undefined
}

export const prisma = globalForPrisma.prisma ?? prismaClientSingleton()

if (!globalForPrisma.prisma) {
  prisma.$connect().then(() => {
    logger.info('Database connected')
  }).catch((err: Error) => {
    logger.error({ err }, 'Database connection failed')
  })
}

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

export default prisma
