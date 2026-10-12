import { Router } from 'express'
import { authenticate } from '../../middlewares/auth.middleware'
import { validate } from '../../middlewares/validate'
import * as clientsController from './clients.controller'
import {
  CreateClientSchema,
  UpdateClientSchema,
  UpdateScratchpadSchema,
  UpdateRequirementsSchema,
} from './clients.schema'

const router = Router()

router.use(authenticate)

router.get('/', clientsController.getClients)
router.post('/', validate(CreateClientSchema), clientsController.createClient)

router.get('/:id', clientsController.getClientById)
router.patch('/:id', validate(UpdateClientSchema), clientsController.updateClient)
router.patch('/:id/scratchpad', validate(UpdateScratchpadSchema), clientsController.updateScratchpad)
router.put('/:id/requirements', validate(UpdateRequirementsSchema), clientsController.updateRequirements)

router.post('/:id/link/regenerate', clientsController.regenerateLink)
router.post('/:id/link/revoke', clientsController.revokeLink)
router.post('/:id/link/restore', clientsController.restoreLink)
router.post('/:id/nudge', clientsController.nudgeClient)

export default router
