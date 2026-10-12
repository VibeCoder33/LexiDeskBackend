import express from 'express'
import helmet from 'helmet'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import { errorHandler } from './middlewares/errorHandler'
import { logger } from './lib/logger'
import { globalLimiter } from './middlewares/rateLimitter'
import prisma from './lib/prisma'

import authRouter from './modules/auth/auth.routes'
import dashboardRouter from './modules/dashboard/dashboard.routes'
import clientsRouter from './modules/clients/clients.routes'
import documentsRouter from './modules/documents/documents.routes'
import searchRouter from './modules/search/search.routes'
import notesRouter from './modules/notes/notes.routes'
import portalRouter from './modules/portal/portal.routes'

const app = express()

app.use(helmet())
app.use(express.json({ limit: '50kb' }))
app.use(cookieParser())

app.use(
  cors({
    origin: process.env.ALLOWED_ORIGINS?.split(',').map((o) => o.trim()) ?? [
      'http://localhost:3000',
      'http://localhost:3001',
      'http://127.0.0.1:3000',
      'http://127.0.0.1:3001',
    ],
    credentials: true,
  })
)

// ── Health check ─────────────────────────────────────────────────────────────
app.get('/health', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`
    res.status(200).json({
      status: 'ok',
      service: 'lexidesk-backend',
      database: 'connected',
      timestamp: new Date().toISOString(),
    })
  } catch (err) {
    logger.error({ err }, 'Health check failed: Database disconnected')
    res.status(503).json({
      status: 'error',
      service: 'lexidesk-backend',
      database: 'disconnected',
      timestamp: new Date().toISOString(),
    })
  }
})

// ── Local Mock Storage Endpoints (For local dev without AWS) ─────────────────
const mockFileStore = new Map<string, { buffer: Buffer; mimeType: string }>()

app.put('/api/mock-upload', express.raw({ type: '*/*', limit: '25mb' }), (req, res) => {
  const key = (req.query.key as string) || 'default-key'
  const mimeType = (req.headers['content-type'] as string) ?? 'application/octet-stream'
  mockFileStore.set(key, { buffer: req.body as Buffer, mimeType })
  res.status(200).send()
})

app.get('/api/mock-download', (req, res) => {
  const key = (req.query.key as string) || 'default-key'
  const file = mockFileStore.get(key)
  if (!file) {
    res.setHeader('Content-Type', 'text/plain')
    res.status(200).send('Sample verified document content (LexiDesk Mock Storage)')
    return
  }
  res.setHeader('Content-Type', file.mimeType)
  res.setHeader(
    'Content-Disposition',
    `inline; filename="${encodeURIComponent(String(req.query.name || 'document'))}"`
  )
  res.status(200).send(file.buffer)
})

// ── Rate limiter & Routes ───────────────────────────────────────────────────
app.use('/api', globalLimiter)

app.use('/api/auth', authRouter)
app.use('/api/dashboard', dashboardRouter)
app.use('/api/clients', clientsRouter)
app.use('/api/documents', documentsRouter)
app.use('/api/search', searchRouter)
app.use('/api/notes', notesRouter)
app.use('/api/portal', portalRouter)

// ── Error handler ─────────────────────────────────────────────────────────────
app.use(errorHandler)

logger.info('LexiDesk Express app configured with all modules')

export default app
