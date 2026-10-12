import { Request, Response, NextFunction } from 'express'
import * as notesService from './notes.service'
import { CreateNoteInput } from './notes.schema'

export const getNotes = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user!.userId
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : undefined

    const result = await notesService.getNotes(userId, limit)
    res.status(200).json(result)
  } catch (err) {
    next(err)
  }
}

export const createNote = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user!.userId
    const { body } = req.body as CreateNoteInput

    const result = await notesService.createNote(userId, body)
    res.status(201).json(result)
  } catch (err) {
    next(err)
  }
}

export const deleteNote = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user!.userId
    const noteId = req.params.id as string

    const result = await notesService.deleteNote(userId, noteId)
    res.status(200).json(result)
  } catch (err) {
    next(err)
  }
}
