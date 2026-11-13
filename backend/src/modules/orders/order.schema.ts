import { z } from "zod";
import { objectIdSchema, paginationQuerySchema } from "../../utils/common.schema.js";
import { ORDER_STATUSES } from "./order.status.js";

// Malta's country code is dropped, so "+356 7912 3456" and "79123456" are the same when searched.
export const normalizePhone = (value: string) =>
  value.replace(/[\s()-]/g, "").replace(/^(\+|00)356/, "");

const orderItemSchema = z.strictObject({
  productId: objectIdSchema.toLowerCase(),
  qty: z.number().int().min(1).max(99),
});

// Strict: prices, deliveryFee and total are always worked out by the server, so sending them is a 400.
export const placeOrderSchema = z.strictObject({
  items: z
    .array(orderItemSchema)
    .min(1)
    .max(50)
    .refine(
      (items) => new Set(items.map(({ productId }) => productId)).size === items.length,
      "Each product can only appear once"
    ),
  delivery: z.strictObject({
    name: z.string().trim().min(1).max(100),
    phone: z
      .string()
      .trim()
      .max(30)
      .transform(normalizePhone)
      .pipe(z.string().regex(/^\+?\d{7,15}$/, "Invalid phone number")),
    address: z.string().trim().min(1).max(300),
    // Delivery covers all of Malta, so any locality is accepted for now.
    locality: z.string().trim().min(1).max(100),
    note: z.string().trim().max(500).optional(),
  }),
});

const dateFilter = z.iso
  .datetime({ offset: true })
  .transform((value) => new Date(value))
  .optional();

export const adminOrderQuerySchema = paginationQuerySchema.extend({
  status: z.enum(ORDER_STATUSES).optional(),
  from: dateFilter,
  to: dateFilter,
  q: z.string().trim().min(1).max(50).optional(),
});

export const updateStatusSchema = z.strictObject({
  status: z.enum(ORDER_STATUSES),
  note: z.string().trim().max(500).optional(),
});

export const updateDeliveryDateSchema = z.strictObject({
  estimatedDeliveryDate: z.iso
    .date()
    .transform((value) => new Date(value))
    .nullable(),
});

// Cash on delivery can only become paid. Other payment statuses wait for digital payment.
export const updatePaymentSchema = z.strictObject({
  paymentStatus: z.literal("paid"),
});

export type PlaceOrderInput = z.infer<typeof placeOrderSchema>;
export type AdminOrderQuery = z.infer<typeof adminOrderQuerySchema>;
export type UpdateStatusInput = z.infer<typeof updateStatusSchema>;

// Takes no params, so any query string returns a 400.
export const adminStatsQuerySchema = z.strictObject({});
