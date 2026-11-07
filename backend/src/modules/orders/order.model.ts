import { Schema, model, type Types } from "mongoose";
import { PAYMENT_METHODS, type PaymentMethod } from "../payments/payment.types.js";
import { ORDER_STATUSES, type OrderStatus } from "./order.status.js";

export const PAYMENT_STATUSES = ["pending", "paid", "failed", "refunded"] as const;

export type OrderItem = {
  productId: Types.ObjectId;
  nameSnapshot: string;
  unitSnapshot: string;
  priceSnapshot: number; // integer cents, what the customer was charged per unit
  qty: number;
};

export type OrderHistoryEntry = {
  status: OrderStatus;
  at: Date;
  by: Types.ObjectId;
  note: string;
};

export type Order = {
  orderNumber: string;
  user: Types.ObjectId;
  items: OrderItem[];
  subtotal: number; // integer cents
  deliveryFee: number; // integer cents
  total: number; // integer cents
  delivery: { name: string; phone: string; address: string; locality: string; note: string };
  paymentMethod: PaymentMethod;
  paymentStatus: (typeof PAYMENT_STATUSES)[number];
  status: OrderStatus;
  estimatedDeliveryDate: Date | null;
  statusHistory: OrderHistoryEntry[];
  createdAt: Date;
  updatedAt: Date;
};

const orderSchema = new Schema<Order>(
  {
    orderNumber: { type: String, required: true, unique: true },
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    items: {
      type: [
        new Schema<OrderItem>(
          {
            productId: { type: Schema.Types.ObjectId, ref: "Product", required: true },
            nameSnapshot: { type: String, required: true },
            unitSnapshot: { type: String, required: true },
            priceSnapshot: { type: Number, required: true },
            qty: { type: Number, required: true },
          },
          { _id: false }
        ),
      ],
      required: true,
    },
    subtotal: { type: Number, required: true },
    deliveryFee: { type: Number, required: true },
    total: { type: Number, required: true },
    delivery: {
      type: new Schema(
        {
          name: { type: String, required: true },
          phone: { type: String, required: true },
          address: { type: String, required: true },
          locality: { type: String, required: true },
          note: { type: String, default: "" },
        },
        { _id: false }
      ),
      required: true,
    },
    paymentMethod: { type: String, enum: PAYMENT_METHODS, required: true, default: "COD" },
    paymentStatus: { type: String, enum: PAYMENT_STATUSES, required: true, default: "pending" },
    status: { type: String, enum: ORDER_STATUSES, required: true, default: "pending" },
    estimatedDeliveryDate: { type: Date, default: null },
    statusHistory: {
      type: [
        new Schema<OrderHistoryEntry>(
          {
            status: { type: String, enum: ORDER_STATUSES, required: true },
            at: { type: Date, required: true },
            by: { type: Schema.Types.ObjectId, ref: "User", required: true },
            note: { type: String, default: "" },
          },
          { _id: false }
        ),
      ],
      required: true,
    },
  },
  { timestamps: true }
);

// Each index ends in createdAt + _id so MongoDB reads lists already sorted, newest first.
const NEWEST_FIRST = { createdAt: -1, _id: -1 } as const;

orderSchema.index({ user: 1, ...NEWEST_FIRST }); // My Orders
orderSchema.index(NEWEST_FIRST); // admin list and date filter
orderSchema.index({ status: 1, ...NEWEST_FIRST }); // admin status filter
orderSchema.index({ "delivery.phone": 1, ...NEWEST_FIRST }); // admin phone search

export const OrderModel = model<Order>("Order", orderSchema);
