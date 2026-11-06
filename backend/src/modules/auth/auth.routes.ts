import { Router } from "express";
import { requireAuth } from "../../middlewares/auth.middleware.js";
import { authRateLimit } from "../../middlewares/rate-limit.middleware.js";
import { validateBody } from "../../middlewares/validate.middleware.js";
import { loginHandler, logoutHandler, meHandler, registerHandler } from "./auth.controller.js";
import { loginSchema, registerSchema } from "./auth.schema.js";

export const authRoutes = Router();

authRoutes.post("/register", authRateLimit, validateBody(registerSchema), registerHandler);
authRoutes.post("/login", authRateLimit, validateBody(loginSchema), loginHandler);
authRoutes.post("/logout", logoutHandler);
authRoutes.get("/me", requireAuth, meHandler);
