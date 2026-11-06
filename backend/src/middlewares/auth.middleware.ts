import type { NextFunction, Request, Response } from "express";
import { verifyToken } from "../modules/auth/session.service.js";
import { findUserById, toPublicUser } from "../modules/users/user.service.js";
import { AppError } from "../utils/app-error.js";

export const ACCESS_COOKIE = "access_token";

// Reads the user from the DB on every request, so a deleted user, changed role or
// cancelled session takes effect at once instead of when the access token expires.
export const requireAuth = async (req: Request, _res: Response, next: NextFunction) => {
  const token: unknown = req.cookies?.[ACCESS_COOKIE];
  if (typeof token !== "string") throw AppError.unauthorized();

  const { userId, tokenVersion } = verifyToken(token, "access");
  const user = await findUserById(userId);
  if (!user || user.tokenVersion !== tokenVersion) throw AppError.unauthorized();

  req.user = toPublicUser(user);
  next();
};
