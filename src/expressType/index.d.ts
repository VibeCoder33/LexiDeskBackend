import { AuthPayload } from '../middlewares/auth.middleware'
import { Role } from '../generated/prisma/enums'

export { Role }

declare global {
  namespace Express {
    interface Request {
      user?: AuthPayload
    }
  }
}

export {}
