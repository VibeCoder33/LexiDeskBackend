import rateLimit from 'express-rate-limit'

// Global Limiter for standard API traffic
export const globalLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS ?? '60000'),
  max: parseInt(process.env.RATE_LIMIT_MAX ?? '200'),
  message: { error: 'Too many requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
})

// Strict Login Limiter to prevent password brute-forcing
export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  message: { error: 'Too many login attempts, please try again after 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
})

// Portal Limiter for client-facing public endpoints
export const portalLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 60,
  message: { error: 'Too many requests from this IP, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
})

// Stricter presign limiter for S3 presigned URL generation
export const presignLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 20,
  message: { error: 'Too many upload requests, please slow down.' },
  standardHeaders: true,
  legacyHeaders: false,
})
