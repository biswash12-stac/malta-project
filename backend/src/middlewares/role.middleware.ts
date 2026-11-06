import type { NextFunction, Request, Response } from "express";
import type { UserRole } from "../modules/users/user.model.js";
import { AppError } from "../utils/app-error.js";

// Use after requireAuth.
export const requireRole =
  (role: UserRole) => (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) throw AppError.unauthorized();
    if (req.user.role !== role) throw AppError.forbidden();
    next();
  };
