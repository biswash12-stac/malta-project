import type { Order } from "../orders/order.model.js";

export const PAYMENT_METHODS = ["COD"] as const;

export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export type PaymentProvider = {
  createPayment(order: Order): Promise<void>;
  verifyPayment(payload: unknown): Promise<void>;
  refund(order: Order): Promise<void>;
};
