export class AppError extends Error {
  constructor(
    public message: string,
    public statusCode: number,
    public details?: Record<string, string[]>
  ) {
    super(message)
    this.name = 'AppError'
    Error.captureStackTrace(this, this.constructor)
  }
}
