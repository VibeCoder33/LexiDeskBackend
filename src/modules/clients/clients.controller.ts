import { Request, Response, NextFunction } from 'express'
import * as clientsService from './clients.service'
import { RoleKey } from '../../config/roles'
import {
  CreateClientInput,
  UpdateClientInput,
  UpdateScratchpadInput,
  UpdateRequirementsInput,
} from './clients.schema'

export const getClients = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user!.userId
    const { q, status, matterType, sort, order, page, limit } = req.query

    const result = await clientsService.getClients(userId, {
      q: typeof q === 'string' ? q : undefined,
      status: typeof status === 'string' ? status : undefined,
      matterType: typeof matterType === 'string' ? matterType : undefined,
      sort: typeof sort === 'string' ? sort : undefined,
      order: order === 'asc' ? 'asc' : 'desc',
      page: page ? parseInt(page as string, 10) : undefined,
      limit: limit ? parseInt(limit as string, 10) : undefined,
    })

    res.status(200).json(result)
  } catch (err) {
    next(err)
  }
}

export const createClient = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user!.userId
    const role = req.user!.role as RoleKey
    const input = req.body as CreateClientInput

    const result = await clientsService.createClient(userId, role, input)
    res.status(201).json(result)
  } catch (err) {
    next(err)
  }
}

export const getClientById = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user!.userId
    const clientId = req.params.id as string

    const result = await clientsService.getClientById(userId, clientId)
    res.status(200).json(result)
  } catch (err) {
    next(err)
  }
}

export const updateClient = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user!.userId
    const clientId = req.params.id as string
    const input = req.body as UpdateClientInput

    const result = await clientsService.updateClient(userId, clientId, input)
    res.status(200).json(result)
  } catch (err) {
    next(err)
  }
}

export const updateScratchpad = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user!.userId
    const clientId = req.params.id as string
    const { scratchpad } = req.body as UpdateScratchpadInput

    const result = await clientsService.updateScratchpad(userId, clientId, scratchpad)
    res.status(200).json(result)
  } catch (err) {
    next(err)
  }
}

export const updateRequirements = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user!.userId
    const clientId = req.params.id as string
    const input = req.body as UpdateRequirementsInput

    const result = await clientsService.updateRequirements(userId, clientId, input)
    res.status(200).json(result)
  } catch (err) {
    next(err)
  }
}

export const regenerateLink = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user!.userId
    const clientId = req.params.id as string

    const result = await clientsService.regenerateLink(userId, clientId)
    res.status(200).json(result)
  } catch (err) {
    next(err)
  }
}

export const revokeLink = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user!.userId
    const clientId = req.params.id as string

    const result = await clientsService.revokeLink(userId, clientId)
    res.status(200).json(result)
  } catch (err) {
    next(err)
  }
}

export const restoreLink = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user!.userId
    const clientId = req.params.id as string

    const result = await clientsService.restoreLink(userId, clientId)
    res.status(200).json(result)
  } catch (err) {
    next(err)
  }
}

export const nudgeClient = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user!.userId
    const clientId = req.params.id as string

    const result = await clientsService.nudgeClient(userId, clientId)
    res.status(200).json(result)
  } catch (err) {
    next(err)
  }
}
