import { rateLimit } from "express-rate-limit";
import { AppError } from "../utils/app-error.js";

// shortcut: counts live in this process's memory, move to a shared store if the API ever runs on more than one instance.
export const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  handler: (_req, _res, next) => next(AppError.tooManyRequests()),
});
