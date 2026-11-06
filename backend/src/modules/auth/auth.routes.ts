import { Router } from "express";
import { requireAuth } from "../../middlewares/auth.middleware.js";
import {
  accountLoginRateLimit,
  authRateLimit,
  forgotPasswordEmailRateLimit,
  forgotPasswordIpRateLimit,
  refreshRateLimit,
} from "../../middlewares/rate-limit.middleware.js";
import { validateRequest } from "../../middlewares/validate.middleware.js";
import {
  disableTwoFactorHandler,
  enableTwoFactorHandler,
  forgotPasswordHandler,
  googleHandler,
  loginHandler,
  logoutHandler,
  meHandler,
  refreshHandler,
  registerHandler,
  requestDisableTwoFactorHandler,
  resetPasswordHandler,
  validateTwoFactorHandler,
  verifyTwoFactorHandler,
} from "./auth.controller.js";
import {
  forgotPasswordSchema,
  googleLoginSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
  twoFactorCodeSchema,
} from "./auth.schema.js";

export const authRoutes = Router();

authRoutes.post(
  "/register",
  authRateLimit,
  validateRequest({ body: registerSchema }),
  registerHandler
);
authRoutes.post(
  "/login",
  authRateLimit,
  validateRequest({ body: loginSchema }),
  accountLoginRateLimit,
  loginHandler
);
authRoutes.post(
  "/google",
  authRateLimit,
  validateRequest({ body: googleLoginSchema }),
  googleHandler
);
authRoutes.post("/refresh", refreshRateLimit, refreshHandler);
authRoutes.post("/logout", logoutHandler);
authRoutes.get("/me", requireAuth, meHandler);

authRoutes.post(
  "/forgot-password",
  forgotPasswordIpRateLimit,
  validateRequest({ body: forgotPasswordSchema }),
  forgotPasswordEmailRateLimit,
  forgotPasswordHandler
);
// The token is in the body, not the URL, because request logs record URLs.
authRoutes.post(
  "/reset-password",
  authRateLimit,
  validateRequest({ body: resetPasswordSchema }),
  resetPasswordHandler
);

const withCode = validateRequest({ body: twoFactorCodeSchema });

authRoutes.post("/2fa/enable", authRateLimit, requireAuth, enableTwoFactorHandler);
authRoutes.post("/2fa/verify", authRateLimit, requireAuth, withCode, verifyTwoFactorHandler);
authRoutes.post("/2fa/disable/request", authRateLimit, requireAuth, requestDisableTwoFactorHandler);
authRoutes.post("/2fa/disable", authRateLimit, requireAuth, withCode, disableTwoFactorHandler);
authRoutes.post("/2fa/validate", authRateLimit, withCode, validateTwoFactorHandler);
