import { Schema, model, type HydratedDocument } from "mongoose";

export const USER_ROLES = ["customer", "admin"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export type User = {
  username: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  tokenVersion: number;
  createdAt: Date;
};

export type UserDocument = HydratedDocument<User>;

const userSchema = new Schema<User>(
  {
    username: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    // select: false so a hash can only leave the DB when a query asks for it by name.
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: USER_ROLES, default: "customer", required: true },
    // Stored in each login token. Increasing it cancels every token issued before.
    tokenVersion: { type: Number, default: 0, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

export const UserModel = model<User>("User", userSchema);
