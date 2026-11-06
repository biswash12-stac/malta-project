import { Router } from "express";
import { requireAuth } from "../../middlewares/auth.middleware.js";
import { requireRole } from "../../middlewares/role.middleware.js";
import { validateRequest } from "../../middlewares/validate.middleware.js";
import { objectIdParamSchema, paginationQuerySchema } from "../../utils/common.schema.js";
import {
  createHandler,
  deleteHandler,
  listActiveHandler,
  listAllHandler,
  updateHandler,
} from "./category.controller.js";
import { createCategorySchema, updateCategorySchema } from "./category.schema.js";

const adminOnly = [requireAuth, requireRole("admin")];

export const categoryRoutes = Router();

categoryRoutes.get("/", validateRequest({ query: paginationQuerySchema }), listActiveHandler);
categoryRoutes.post("/", adminOnly, validateRequest({ body: createCategorySchema }), createHandler);
categoryRoutes.patch(
  "/:id",
  adminOnly,
  validateRequest({ params: objectIdParamSchema, body: updateCategorySchema }),
  updateHandler
);
categoryRoutes.delete(
  "/:id",
  adminOnly,
  validateRequest({ params: objectIdParamSchema }),
  deleteHandler
);

// Separate from the public list, because admins also need to see hidden categories.
export const adminCategoryRoutes = Router();

adminCategoryRoutes.get(
  "/",
  adminOnly,
  validateRequest({ query: paginationQuerySchema }),
  listAllHandler
);
