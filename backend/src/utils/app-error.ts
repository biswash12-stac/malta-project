export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details?: unknown;

  constructor(statusCode: number, code: string, message: string, details?: unknown) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }

  static badRequest(message: string, details?: unknown) {
    return new AppError(400, "VALIDATION_ERROR", message, details);
  }
  static unauthorized(message = "Not authenticated") {
    return new AppError(401, "UNAUTHENTICATED", message);
  }
  static forbidden(message = "Forbidden") {
    return new AppError(403, "FORBIDDEN", message);
  }
  static notFound(message = "Not found") {
    return new AppError(404, "NOT_FOUND", message);
  }
  static conflict(message: string) {
    return new AppError(409, "CONFLICT", message);
  }
  static tooManyRequests(message = "Too many attempts, try again later") {
    return new AppError(429, "RATE_LIMITED", message);
  }
  static internal(message = "Internal server error") {
    return new AppError(500, "INTERNAL", message);
  }
}
