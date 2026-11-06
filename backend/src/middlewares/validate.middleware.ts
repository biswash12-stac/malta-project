import type { NextFunction, Request, Response } from "express";
import type { ZodType } from "zod";

type RequestSchemas = {
  params?: ZodType;
  query?: ZodType;
  body?: ZodType;
};

// Handlers receive the parsed values, so `?page=2` arrives as the number 2.
// A ZodError thrown here becomes a 400 in the global error handler.
export const validateRequest =
  ({ params, query, body }: RequestSchemas) =>
  (req: Request, _res: Response, next: NextFunction) => {
    if (params) req.params = params.parse(req.params) as Request["params"];
    if (query) {
      // Express 5's req.query is a getter with no setter, so it can't be assigned to.
      Object.defineProperty(req, "query", {
        value: query.parse(req.query),
        writable: true,
        configurable: true,
        enumerable: true,
      });
    }
    if (body) req.body = body.parse(req.body);
    next();
  };
