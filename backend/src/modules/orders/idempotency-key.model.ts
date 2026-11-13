import { Schema, model, type Types } from "mongoose";

// One checkout per Idempotency-Key and user. Saved inside the checkout transaction, so a key
// exists only if its order does.
export type IdempotencyKey = {
  user: Types.ObjectId;
  key: string;
  requestHash: string; // SHA-256 of the checkout body, so a reused key can't place a different cart
  order: Types.ObjectId;
  createdAt: Date;
};

const idempotencyKeySchema = new Schema<IdempotencyKey>(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    key: { type: String, required: true },
    requestHash: { type: String, required: true },
    order: { type: Schema.Types.ObjectId, ref: "Order", required: true },
    // MongoDB deletes the key about 24 hours later, so the collection can't keep growing.
    createdAt: { type: Date, default: Date.now, expires: 24 * 60 * 60 },
  },
  { versionKey: false }
);

// Keys are per user, so one customer's key can never return another customer's order.
idempotencyKeySchema.index({ user: 1, key: 1 }, { unique: true });

export const IdempotencyKeyModel = model<IdempotencyKey>("IdempotencyKey", idempotencyKeySchema);
