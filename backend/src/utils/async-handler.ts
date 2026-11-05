import type { Request, Response, NextFunction, RequestHandler } from "express";

type AsyncFn = (req: Request, res: Response, next: NextFunction) => Promise<unknown>;

/**
 * Wraps an async route handler so thrown errors reach Express's error middleware.
 * Without this, an `await` that rejects will not be caught by Express 4.
 */
export const asyncHandler =
  (fn: AsyncFn): RequestHandler =>
  (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };