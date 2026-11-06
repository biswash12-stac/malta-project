import type { NextFunction, Request, Response } from "express";
import type { ZodType } from "zod";

// A ZodError thrown here becomes a 400 in the global error handler.
// shortcut: body only, add query/params in Phase 3. Express 5's req.query is read-only, so parsed queries can't be assigned back.
export const validateBody =
  (schema: ZodType) => (req: Request, _res: Response, next: NextFunction) => {
    req.body = schema.parse(req.body);
    next();
  };
