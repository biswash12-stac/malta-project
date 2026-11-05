import { Router } from "express";
import { sendSuccess } from "../utils/api-response.js";

export const router = Router();

/**
 * GET /api/v1/health
 * Liveness probe. No DB call, no auth, no dependency.
 * Used by deploy platform and uptime monitors.
 */
router.get("/health", (_req, res) => {
  sendSuccess(res, { status: "ok", uptime: process.uptime() });
});

// Modules are mounted here as we build them:
// router.use("/auth", authRoutes);
// router.use("/products", productRoutes);
// router.use("/categories", categoryRoutes);
// router.use("/orders", orderRoutes);
// router.use("/admin", adminRoutes);