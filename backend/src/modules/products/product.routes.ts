import { Router } from "express";
import { requireAuth } from "../../middlewares/auth.middleware.js";
import { requireRole } from "../../middlewares/role.middleware.js";
import { validateRequest } from "../../middlewares/validate.middleware.js";
import { objectIdParamSchema } from "../../utils/common.schema.js";
import {
  createHandler,
  deleteHandler,
  getAdminHandler,
  getPublicHandler,
  listAdminHandler,
  listPublicHandler,
  updateHandler,
} from "./product.controller.js";
import {
  adminProductQuerySchema,
  createProductSchema,
  productSlugParamSchema,
  publicProductQuerySchema,
  updateProductSchema,
} from "./product.schema.js";

const adminOnly = [requireAuth, requireRole("admin")];

export const productRoutes = Router();

productRoutes.get("/", validateRequest({ query: publicProductQuerySchema }), listPublicHandler);
productRoutes.get("/:slug", validateRequest({ params: productSlugParamSchema }), getPublicHandler);
productRoutes.post("/", adminOnly, validateRequest({ body: createProductSchema }), createHandler);
productRoutes.patch(
  "/:id",
  adminOnly,
  validateRequest({ params: objectIdParamSchema, body: updateProductSchema }),
  updateHandler
);
productRoutes.delete(
  "/:id",
  adminOnly,
  validateRequest({ params: objectIdParamSchema }),
  deleteHandler
);

// Separate from the public routes, because admins also need to see hidden products.
export const adminProductRoutes = Router();

adminProductRoutes.get(
  "/",
  adminOnly,
  validateRequest({ query: adminProductQuerySchema }),
  listAdminHandler
);
adminProductRoutes.get(
  "/:id",
  adminOnly,
  validateRequest({ params: objectIdParamSchema }),
  getAdminHandler
);
