import type { NextFunction, Request, Response } from "express";
import { verifyToken } from "../modules/auth/auth.service.js";
import { findUserById, toPublicUser } from "../modules/users/user.service.js";
import { AppError } from "../utils/app-error.js";

export const AUTH_COOKIE = "auth_token";

// Reads the user from the DB on every request, so a deleted user, changed role or
// cancelled session takes effect at once instead of when the 7-day token expires.
export const requireAuth = async (req: Request, _res: Response, next: NextFunction) => {
  const token: unknown = req.cookies?.[AUTH_COOKIE];
  if (typeof token !== "string") throw AppError.unauthorized();

  const { userId, tokenVersion } = verifyToken(token);
  const user = await findUserById(userId);
  if (!user || user.tokenVersion !== tokenVersion) throw AppError.unauthorized();

  req.user = toPublicUser(user);
  next();
};
