import 'dotenv/config'
import app from './app'
import { logger } from './lib/logger'
import prisma from './lib/prisma'
import bcrypt from 'bcryptjs'

const REQUIRED_ENV_VARS = ['DATABASE_URL', 'JWT_SECRET']

const validateEnv = () => {
  const missing = REQUIRED_ENV_VARS.filter((key) => !process.env[key])
  if (missing.length > 0) {
    logger.error(`Missing required environment variables: ${missing.join(', ')}`)
    process.exit(1)
  }
}

const seedAdmin = async () => {
  const email = process.env.SEED_ADMIN_EMAIL
  const password = process.env.SEED_ADMIN_PASSWORD
  const name = process.env.SEED_ADMIN_NAME
  const mobile = process.env.SEED_ADMIN_MOBILE

  if (!email || !password || !name || !mobile) {
    logger.info('Missing one or more SEED_ADMIN_* environment variables — skipping seed')
    return
  }

  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) {
    logger.info('Admin already exists — skipping seed')
    return
  }

  const passwordHash = await bcrypt.hash(password, 12)
  await prisma.user.create({
    data: { name, email, mobile, passwordHash, role: 'SUPER', isActive: true },
  })

  logger.info({ email }, 'Admin (SUPER) user seeded')
}

const start = async () => {
  validateEnv()
  await seedAdmin()

  const PORT = process.env.PORT ?? 3000

  const server = app.listen(PORT, () => {
    logger.info(`LexiDesk server running on port ${PORT} in ${process.env.NODE_ENV ?? 'development'} mode`)
  })

  const shutdown = async (signal: string) => {
    logger.info(`${signal} received: gracefully shutting down...`)

    server.close(async () => {
      logger.info('HTTP server closed.')
      await prisma.$disconnect()
      logger.info('Database connection closed.')
      process.exit(0)
    })

    setTimeout(() => {
      logger.error('Forcefully terminating due to timeout')
      process.exit(1)
    }, 10000)
  }

  process.on('SIGTERM', () => shutdown('SIGTERM'))
  process.on('SIGINT', () => shutdown('SIGINT'))
}

start().catch((err: Error) => {
  logger.error(err, 'Failed to start server')
  process.exit(1)
})
