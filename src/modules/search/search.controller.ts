import { Request, Response, NextFunction } from 'express'
import * as searchService from './search.service'

export const search = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user!.userId
    const q = (req.query.q as string) ?? ''

    const result = await searchService.searchOmni(userId, q)
    res.status(200).json(result)
  } catch (err) {
    next(err)
  }
}
