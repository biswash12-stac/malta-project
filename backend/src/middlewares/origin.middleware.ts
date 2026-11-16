import type { NextFunction, Request, Response } from "express";
import { CLIENT_ORIGIN } from "../config/env.js";
import { AppError } from "../utils/app-error.js";

const STATE_CHANGING = new Set(["POST", "PUT", "PATCH", "DELETE"]);

// CSRF defence in depth for cookie sessions. CORS only stops other sites *reading* responses; this
// stops them *sending* state-changing requests, including from a compromised sibling subdomain,
// which SameSite=Lax treats as the same site.
//
// Policy:
// - POST, PUT, PATCH and DELETE with an Origin header must match CLIENT_URL's origin exactly
//   (scheme, host and port). Anything else, including "null", gets a 403 before any handler runs.
// - A missing Origin is allowed. Browsers always send Origin on these methods, so a request
//   without one comes from curl, Postman or a server, which cannot carry a victim's cookies.
// - GET, HEAD and OPTIONS are never checked; reads change nothing and CORS handles preflights.
export const requireSameOrigin = (req: Request, _res: Response, next: NextFunction) => {
  if (!STATE_CHANGING.has(req.method)) return next();
  const origin = req.get("Origin");
  if (origin !== undefined && origin !== CLIENT_ORIGIN) {
    throw AppError.forbidden("Request origin not allowed");
  }
  next();
};
