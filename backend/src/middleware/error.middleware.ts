import type { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";
import mongoose from "mongoose";
import { logger } from "../utils/logger.js";
import type { ApiError } from "../utils/api-response.js";

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
  static internal(message = "Internal server error") {
    return new AppError(500, "INTERNAL", message);
  }
}

export const notFoundHandler = (req: Request, _res: Response, next: NextFunction) => {
  next(AppError.notFound(`Route ${req.method} ${req.originalUrl} not found`));
};

// Express recognizes an error middleware by its 4-arg signature.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const errorHandler = (
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction
): void => {
  // AppError — expected business error
  if (err instanceof AppError) {
    const body: ApiError = {
      success: false,
      error: { code: err.code, message: err.message, details: err.details },
    };
    res.status(err.statusCode).json(body);
    return;
  }

  // zod validation error (when you validate with zod in handlers/services)
  if (err instanceof ZodError) {
    const body: ApiError = {
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Invalid input",
        details: err.flatten().fieldErrors,
      },
    };
    res.status(400).json(body);
    return;
  }

  // mongoose CastError — e.g. bad ObjectId in URL param
  if (err instanceof mongoose.Error.CastError) {
    res.status(400).json({
      success: false,
      error: { code: "VALIDATION_ERROR", message: `Invalid ${err.path}` },
    });
    return;
  }

  // mongoose duplicate key (unique index violation)
  if (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: number }).code === 11000
  ) {
    res.status(409).json({
      success: false,
      error: { code: "CONFLICT", message: "Duplicate resource" },
    });
    return;
  }

  // Unknown — log with stack, never leak to client
  const message = err instanceof Error ? err.message : "Unknown error";
  const stack = err instanceof Error ? err.stack : undefined;
  logger.error({ msg: "Unhandled error", path: req.originalUrl, method: req.method, message, stack });

  res.status(500).json({
    success: false,
    error: { code: "INTERNAL", message: "Internal server error" },
  });
};