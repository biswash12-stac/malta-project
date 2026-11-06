import type { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";
import mongoose from "mongoose";
import { logger } from "../utils/logger.js";
import { AppError } from "../utils/app-error.js";
import type { ApiError } from "../utils/api-response.js";

// Errors about the input as a whole, such as an unknown param, have no field to sit under.
const zodErrorDetails = (err: ZodError) => {
  const { fieldErrors, formErrors } = err.flatten();
  return formErrors.length > 0 ? { ...fieldErrors, _form: formErrors } : fieldErrors;
};

export const notFoundHandler = (req: Request, _res: Response, next: NextFunction) => {
  next(AppError.notFound(`Route ${req.method} ${req.originalUrl} not found`));
};

// Express recognizes an error middleware by its 4-arg signature.
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
        details: zodErrorDetails(err),
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

  // mongoose schema validation — data that zod let through but the model rejects
  if (err instanceof mongoose.Error.ValidationError) {
    res.status(400).json({
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Invalid input",
        details: Object.fromEntries(
          Object.entries(err.errors).map(([field, { message }]) => [field, [message]])
        ),
      },
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

  // Express and body-parser mark client errors with a status: broken JSON (400), body too big (413)
  const status = (err as { status?: unknown } | null)?.status;
  if (typeof status === "number" && status >= 400 && status < 500) {
    res.status(status).json({
      success: false,
      error: { code: "BAD_REQUEST", message: "Invalid request" },
    });
    return;
  }

  // Unknown — log with stack, never leak to client
  const message = err instanceof Error ? err.message : "Unknown error";
  const stack = err instanceof Error ? err.stack : undefined;
  logger.error({
    msg: "Unhandled error",
    path: req.originalUrl,
    method: req.method,
    message,
    stack,
  });

  res.status(500).json({
    success: false,
    error: { code: "INTERNAL", message: "Internal server error" },
  });
};
