import { Request, Response, NextFunction } from 'express'
import * as portalService from './portal.service'
import { PortalPresignInput, PortalCompleteInput } from './portal.schema'

export const getPortal = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const token = req.params.token as string
    const result = await portalService.getPortalInfo(token)
    res.status(200).json(result)
  } catch (err) {
    next(err)
  }
}

export const presignUpload = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const token = req.params.token as string
    const input = req.body as PortalPresignInput

    const result = await portalService.presignPortalUpload(token, input)
    res.status(200).json(result)
  } catch (err) {
    next(err)
  }
}

export const completeUpload = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const token = req.params.token as string
    const input = req.body as PortalCompleteInput

    const result = await portalService.completePortalUpload(token, input)
    res.status(201).json(result)
  } catch (err) {
    next(err)
  }
}
