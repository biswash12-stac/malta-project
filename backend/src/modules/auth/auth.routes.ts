import { Router } from "express";
import { requireAuth } from "../../middlewares/auth.middleware.js";
import { accountLoginRateLimit, authRateLimit } from "../../middlewares/rate-limit.middleware.js";
import { validateRequest } from "../../middlewares/validate.middleware.js";
import { loginHandler, logoutHandler, meHandler, registerHandler } from "./auth.controller.js";
import { loginSchema, registerSchema } from "./auth.schema.js";

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
authRoutes.post("/logout", logoutHandler);
authRoutes.get("/me", requireAuth, meHandler);
