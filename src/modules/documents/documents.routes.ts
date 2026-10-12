import { Router } from 'express'
import { authenticate } from '../../middlewares/auth.middleware'
import { validate } from '../../middlewares/validate'
import * as documentsController from './documents.controller'
import { UpdateDocumentSchema } from './documents.schema'

const router = Router()

router.use(authenticate)

router.get('/:id/preview-url', documentsController.getPreviewUrl)
router.patch('/:id', validate(UpdateDocumentSchema), documentsController.updateDocument)
router.delete('/:id', documentsController.deleteDocument)

export default router
