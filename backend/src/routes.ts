import { Router } from "express";
import { authRoutes } from "./modules/auth/auth.routes.js";
import { adminCategoryRoutes, categoryRoutes } from "./modules/categories/category.routes.js";
import { adminProductRoutes, productRoutes } from "./modules/products/product.routes.js";
import { uploadRoutes } from "./modules/uploads/upload.routes.js";
import { sendSuccess } from "./utils/api-response.js";

export const router = Router();

/**
 * GET /api/v1/health
 * Liveness probe. No DB call, no auth, no dependency.
 * Used by deploy platform and uptime monitors.
 */
router.get("/health", (_req, res) => {
  sendSuccess(res, { status: "ok", uptime: process.uptime() });
});

router.use("/auth", authRoutes);
router.use("/categories", categoryRoutes);
router.use("/admin/categories", adminCategoryRoutes);
router.use("/products", productRoutes);
router.use("/admin/products", adminProductRoutes);
router.use("/admin/uploads", uploadRoutes);

// Modules are mounted here as we build them:
// router.use("/orders", orderRoutes);
// router.use("/admin", adminRoutes);
