import { Request, Response, NextFunction } from 'express'
import * as documentsService from './documents.service'
import { UpdateDocumentInput } from './documents.schema'

export const getPreviewUrl = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user!.userId
    const documentId = req.params.id as string

    const result = await documentsService.getDocumentPreviewUrl(userId, documentId)
    res.status(200).json(result)
  } catch (err) {
    next(err)
  }
}

export const updateDocument = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user!.userId
    const documentId = req.params.id as string
    const input = req.body as UpdateDocumentInput

    const result = await documentsService.updateDocument(userId, documentId, input)
    res.status(200).json(result)
  } catch (err) {
    next(err)
  }
}

export const deleteDocument = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user!.userId
    const documentId = req.params.id as string

    const result = await documentsService.deleteDocument(userId, documentId)
    res.status(200).json(result)
  } catch (err) {
    next(err)
  }
}
