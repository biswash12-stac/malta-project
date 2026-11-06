import type { CookieOptions, Request, Response } from "express";
import { env } from "../../config/env.js";
import { ACCESS_COOKIE } from "../../middlewares/auth.middleware.js";
import { sendSuccess } from "../../utils/api-response.js";
import { AppError } from "../../utils/app-error.js";
import { toPublicUser } from "../users/user.service.js";
import {
  finishTwoFactorLogin,
  googleLogin,
  login,
  logout,
  register,
  type LoginResult,
} from "./auth.service.js";
import { requestPasswordReset, resetPassword } from "./password-reset.service.js";
import {
  ACCESS_SECONDS,
  PENDING_LOGIN_SECONDS,
  REFRESH_SECONDS,
  refreshSession,
} from "./session.service.js";
import {
  confirmDisable,
  confirmEnable,
  requestDisable,
  requestEnable,
} from "./two-factor.service.js";

const REFRESH_COOKIE = "refresh_token";
const PENDING_COOKIE = "two_factor_pending";

const baseCookie: CookieOptions = {
  httpOnly: true,
  secure: env.isProduction,
  domain: env.COOKIE_DOMAIN,
};
const accessCookie: CookieOptions = { ...baseCookie, sameSite: "lax", path: "/" };
// Strict, and only sent to auth routes: the longest-lived token gets the least exposure.
const refreshCookie: CookieOptions = { ...baseCookie, sameSite: "strict", path: "/api/v1/auth" };
const pendingCookie: CookieOptions = {
  ...baseCookie,
  sameSite: "strict",
  path: "/api/v1/auth/2fa",
};

const setAccessCookie = (res: Response, token: string) =>
  res.cookie(ACCESS_COOKIE, token, { ...accessCookie, maxAge: ACCESS_SECONDS * 1000 });

const setRefreshCookie = (res: Response, token: string) =>
  res.cookie(REFRESH_COOKIE, token, { ...refreshCookie, maxAge: REFRESH_SECONDS * 1000 });

const clearSessionCookies = (res: Response) => {
  res.clearCookie(ACCESS_COOKIE, accessCookie);
  res.clearCookie(REFRESH_COOKIE, refreshCookie);
  res.clearCookie(PENDING_COOKIE, pendingCookie);
};

// Tokens only ever leave in httpOnly cookies, never in the response body.
const sendLoginResult = (res: Response, result: LoginResult, statusCode = 200) => {
  if ("requires2FA" in result) {
    res.cookie(PENDING_COOKIE, result.pendingToken, {
      ...pendingCookie,
      maxAge: PENDING_LOGIN_SECONDS * 1000,
    });
    sendSuccess(res, { requires2FA: true });
    return;
  }
  setAccessCookie(res, result.accessToken);
  setRefreshCookie(res, result.refreshToken);
  sendSuccess(res, { user: result.user }, statusCode);
};

const userIdOf = (req: Request): string => {
  if (!req.user) throw AppError.unauthorized();
  return req.user.id;
};

export const registerHandler = async (req: Request, res: Response) => {
  sendLoginResult(res, await register(req.body), 201);
};

export const loginHandler = async (req: Request, res: Response) => {
  sendLoginResult(res, await login(req.body));
};

export const googleHandler = async (req: Request, res: Response) => {
  sendLoginResult(res, await googleLogin(req.body.credential));
};

export const refreshHandler = async (req: Request, res: Response) => {
  const token: unknown = req.cookies?.[REFRESH_COOKIE];
  try {
    if (typeof token !== "string") throw AppError.unauthorized();
    const session = await refreshSession(token);
    setAccessCookie(res, session.accessToken);
    if (session.refreshToken) setRefreshCookie(res, session.refreshToken);
    sendSuccess(res, { user: toPublicUser(session.user) });
  } catch (err) {
    if (err instanceof AppError) clearSessionCookies(res);
    throw err;
  }
};

export const logoutHandler = async (req: Request, res: Response) => {
  await logout(req.cookies?.[ACCESS_COOKIE], req.cookies?.[REFRESH_COOKIE]);
  clearSessionCookies(res);
  sendSuccess(res, null);
};

export const meHandler = (req: Request, res: Response) => {
  sendSuccess(res, { user: req.user });
};

export const forgotPasswordHandler = (req: Request, res: Response) => {
  requestPasswordReset(req.body.email);
  sendSuccess(res, null, 200, "If that email has an account, a reset link is on its way");
};

export const resetPasswordHandler = async (req: Request, res: Response) => {
  await resetPassword(req.body.token, req.body.password);
  clearSessionCookies(res);
  sendSuccess(res, null);
};

export const enableTwoFactorHandler = async (req: Request, res: Response) => {
  await requestEnable(userIdOf(req));
  sendSuccess(res, null, 200, "A verification code has been emailed");
};

export const verifyTwoFactorHandler = async (req: Request, res: Response) => {
  await confirmEnable(userIdOf(req), req.body.code);
  sendSuccess(res, { twoFactorEnabled: true });
};

export const requestDisableTwoFactorHandler = async (req: Request, res: Response) => {
  await requestDisable(userIdOf(req));
  sendSuccess(res, null, 200, "A verification code has been emailed");
};

export const disableTwoFactorHandler = async (req: Request, res: Response) => {
  await confirmDisable(userIdOf(req), req.body.code);
  sendSuccess(res, { twoFactorEnabled: false });
};

export const validateTwoFactorHandler = async (req: Request, res: Response) => {
  const result = await finishTwoFactorLogin(req.cookies?.[PENDING_COOKIE], req.body.code);
  res.clearCookie(PENDING_COOKIE, pendingCookie);
  sendLoginResult(res, result);
};
