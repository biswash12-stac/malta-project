import { Router } from "express";
import { requireAuth } from "../../middlewares/auth.middleware.js";
import { requireRole } from "../../middlewares/role.middleware.js";
import { validateRequest } from "../../middlewares/validate.middleware.js";
import { objectIdParamSchema } from "../../utils/common.schema.js";
import {
  getAdminHandler,
  listAdminHandler,
  updateDeliveryDateHandler,
  updatePaymentHandler,
  updateStatusHandler,
} from "./order.controller.js";
import {
  adminOrderQuerySchema,
  updateDeliveryDateSchema,
  updatePaymentSchema,
  updateStatusSchema,
} from "./order.schema.js";

export const adminOrderRoutes = Router();

adminOrderRoutes.use(requireAuth, requireRole("admin"));

adminOrderRoutes.get("/", validateRequest({ query: adminOrderQuerySchema }), listAdminHandler);
adminOrderRoutes.get("/:id", validateRequest({ params: objectIdParamSchema }), getAdminHandler);
adminOrderRoutes.patch(
  "/:id/status",
  validateRequest({ params: objectIdParamSchema, body: updateStatusSchema }),
  updateStatusHandler
);
adminOrderRoutes.patch(
  "/:id/delivery-date",
  validateRequest({ params: objectIdParamSchema, body: updateDeliveryDateSchema }),
  updateDeliveryDateHandler
);
adminOrderRoutes.patch(
  "/:id/payment",
  validateRequest({ params: objectIdParamSchema, body: updatePaymentSchema }),
  updatePaymentHandler
);
