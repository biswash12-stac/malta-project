import type { Request } from "express";
import { rateLimit } from "express-rate-limit";
import { AppError } from "../utils/app-error.js";

const limitOptions = {
  standardHeaders: "draft-8",
  legacyHeaders: false,
  handler: (_req: Request, _res: unknown, next: (err: AppError) => void) =>
    next(AppError.tooManyRequests()),
} as const;

// shortcut: counts live in this process's memory, move to a shared store if the API ever runs on more than one instance.
export const authRateLimit = rateLimit({
  ...limitOptions,
  windowMs: 15 * 60 * 1000,
  limit: 20,
});

// Stops guessing one account's password from many IP addresses. Only failed logins count.
// The account's owner is also blocked during an attack, for at most 15 minutes.
// Use after validateRequest, so the email is already checked and lowercased.
export const accountLoginRateLimit = rateLimit({
  ...limitOptions,
  windowMs: 15 * 60 * 1000,
  limit: 10,
  skipSuccessfulRequests: true,
  keyGenerator: (req) => (req.body as { email: string }).email,
});

// shortcut: Next.js server rendering sends catalog requests from one server IP, raise this limit if real traffic reaches it.
export const generalRateLimit = rateLimit({
  ...limitOptions,
  windowMs: 60 * 1000,
  limit: 300,
  // Uptime monitors and the host's health checks must keep working.
  skip: (req) => req.path === "/api/v1/health",
});
