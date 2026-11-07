import { Router } from "express";
import { requireAuth } from "../../middlewares/auth.middleware.js";
import { orderRateLimit } from "../../middlewares/rate-limit.middleware.js";
import { validateRequest } from "../../middlewares/validate.middleware.js";
import { objectIdParamSchema, paginationQuerySchema } from "../../utils/common.schema.js";
import { getMineHandler, listMineHandler, placeHandler } from "./order.controller.js";
import { placeOrderSchema } from "./order.schema.js";

export const orderRoutes = Router();

// Guests can browse and keep a cart in the browser, but ordering needs an account.
orderRoutes.use(requireAuth);

orderRoutes.post("/", orderRateLimit, validateRequest({ body: placeOrderSchema }), placeHandler);
// Registered before /:id, or /:id would capture "mine".
orderRoutes.get("/mine", validateRequest({ query: paginationQuerySchema }), listMineHandler);
orderRoutes.get("/:id", validateRequest({ params: objectIdParamSchema }), getMineHandler);
