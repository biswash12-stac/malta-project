import type { CookieOptions, Request, Response } from "express";
import { env } from "../../config/env.js";
import { sendSuccess } from "../../utils/api-response.js";
import { AUTH_COOKIE } from "../../middlewares/auth.middleware.js";
import { login, register, SESSION_SECONDS, signToken } from "./auth.service.js";

const cookieOptions: CookieOptions = {
  httpOnly: true,
  secure: env.isProduction,
  sameSite: "lax",
  domain: env.COOKIE_DOMAIN,
  path: "/",
};

const setAuthCookie = (res: Response, userId: string) =>
  res.cookie(AUTH_COOKIE, signToken(userId), {
    ...cookieOptions,
    maxAge: SESSION_SECONDS * 1000,
  });

export const registerHandler = async (req: Request, res: Response) => {
  const user = await register(req.body);
  setAuthCookie(res, user.id);
  sendSuccess(res, { user }, 201);
};

export const loginHandler = async (req: Request, res: Response) => {
  const user = await login(req.body);
  setAuthCookie(res, user.id);
  sendSuccess(res, { user });
};

export const logoutHandler = (_req: Request, res: Response) => {
  res.clearCookie(AUTH_COOKIE, cookieOptions);
  sendSuccess(res, null);
};

export const meHandler = (req: Request, res: Response) => {
  sendSuccess(res, { user: req.user });
};
