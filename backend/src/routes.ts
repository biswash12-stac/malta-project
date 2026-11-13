import { Router } from "express";
import mongoose from "mongoose";
import { authRoutes } from "./modules/auth/auth.routes.js";
import { adminCategoryRoutes, categoryRoutes } from "./modules/categories/category.routes.js";
import { adminOrderRoutes, adminStatsRoutes } from "./modules/orders/order.admin.routes.js";
import { orderRoutes } from "./modules/orders/order.routes.js";
import { adminProductRoutes, productRoutes } from "./modules/products/product.routes.js";
import { uploadRoutes } from "./modules/uploads/upload.routes.js";
import { sendSuccess } from "./utils/api-response.js";
import { AppError } from "./utils/app-error.js";

export const router = Router();

/**
 * GET /api/v1/health
 * Liveness probe. No DB call, no auth, no dependency.
 * Used by deploy platform and uptime monitors.
 */
router.get("/health", (_req, res) => {
  sendSuccess(res, { status: "ok", uptime: process.uptime() });
});

/**
 * GET /api/v1/health/ready
 * Readiness probe: 200 only when MongoDB answers a ping, otherwise 503, so the load balancer
 * stops sending traffic to an instance that can't reach the database.
 */
router.get("/health/ready", async (_req, res) => {
  const unavailable = new AppError(503, "DATABASE_UNAVAILABLE", "Database is not reachable");
  const { db, readyState } = mongoose.connection;
  if (readyState !== mongoose.ConnectionStates.connected || !db) throw unavailable;
  // Fails within serverSelectionTimeoutMS (5 seconds) if the connection has dropped.
  await db.command({ ping: 1 }).catch(() => {
    throw unavailable;
  });
  sendSuccess(res, { status: "ready" });
});

router.use("/auth", authRoutes);
router.use("/categories", categoryRoutes);
router.use("/admin/categories", adminCategoryRoutes);
router.use("/products", productRoutes);
router.use("/admin/products", adminProductRoutes);
router.use("/admin/uploads", uploadRoutes);
router.use("/orders", orderRoutes);
router.use("/admin/orders", adminOrderRoutes);
router.use("/admin/stats", adminStatsRoutes);

// Modules are mounted here as we build them:
// router.use("/admin", adminRoutes);
