import { Request, Response, NextFunction } from 'express'
import * as dashboardService from './dashboard.service'
import { RoleKey } from '../../config/roles'

export const getDashboard = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user!.userId
    const role = req.user!.role as RoleKey

    const result = await dashboardService.getDashboardData(userId, role)
    res.status(200).json(result)
  } catch (err) {
    next(err)
  }
}
