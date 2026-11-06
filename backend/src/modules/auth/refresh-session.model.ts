import { Schema, model, type Types } from "mongoose";

export type RefreshSession = {
  user: Types.ObjectId;
  tokenHash: string; // SHA-256 of the cookie's value, so a database leak gives no usable tokens
  tokenVersion: number; // the user's version at login: a newer version cancels this session
  replacedAt: Date | null; // kept after rotation, so a reused token can be recognised as theft
  expiresAt: Date;
};

const refreshSessionSchema = new Schema<RefreshSession>({
  user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  tokenHash: { type: String, required: true, unique: true },
  tokenVersion: { type: Number, required: true },
  replacedAt: { type: Date, default: null },
  // MongoDB deletes each row once this time has passed.
  expiresAt: { type: Date, required: true, index: { expires: 0 } },
});

export const RefreshSessionModel = model<RefreshSession>("RefreshSession", refreshSessionSchema);
