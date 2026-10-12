import { Router } from 'express'
import { authenticate } from '../../middlewares/auth.middleware'
import { validate } from '../../middlewares/validate'
import * as notesController from './notes.controller'
import { CreateNoteSchema } from './notes.schema'

const router = Router()

router.use(authenticate)

router.get('/', notesController.getNotes)
router.post('/', validate(CreateNoteSchema), notesController.createNote)
router.delete('/:id', notesController.deleteNote)

export default router
