import { Router } from 'express'
import { portalLimiter, presignLimiter } from '../../middlewares/rateLimitter'
import { validate } from '../../middlewares/validate'
import * as portalController from './portal.controller'
import { PortalPresignSchema, PortalCompleteSchema } from './portal.schema'

const router = Router()

// Public portal routes: no auth cookies, dedicated rate limiters
router.use(portalLimiter)

router.get('/:token', portalController.getPortal)
router.post(
  '/:token/uploads/presign',
  presignLimiter,
  validate(PortalPresignSchema),
  portalController.presignUpload
)
router.post(
  '/:token/uploads/complete',
  validate(PortalCompleteSchema),
  portalController.completeUpload
)

export default router
