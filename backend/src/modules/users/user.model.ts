import { Schema, model, type HydratedDocument } from "mongoose";

export const USER_ROLES = ["customer", "admin"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export type User = {
  username: string;
  email: string;
  passwordHash?: string; // absent on accounts that only use Google
  role: UserRole;
  tokenVersion: number;
  googleId?: string;
  emailVerified: boolean;
  passwordResetToken?: string; // SHA-256 of the emailed token
  passwordResetExpires?: Date;
  twoFactorEnabled: boolean;
  twoFactorCode?: string; // HMAC of the emailed code
  twoFactorExpires?: Date;
  twoFactorAttempts?: number;
  twoFactorNextCodeAt?: Date | null;
  createdAt: Date;
};

export type UserDocument = HydratedDocument<User>;

const userSchema = new Schema<User>(
  {
    username: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    // select: false so a hash can only leave the DB when a query asks for it by name.
    passwordHash: { type: String, select: false },
    role: { type: String, enum: USER_ROLES, default: "customer", required: true },
    // Stored in each login token. Increasing it cancels every token issued before.
    tokenVersion: { type: Number, default: 0, required: true },
    googleId: { type: String, index: { unique: true, sparse: true } },
    emailVerified: { type: Boolean, default: false, required: true },
    passwordResetToken: { type: String, select: false, index: { sparse: true } },
    passwordResetExpires: { type: Date, select: false },
    twoFactorEnabled: { type: Boolean, default: false, required: true },
    twoFactorCode: { type: String, select: false },
    twoFactorExpires: { type: Date, select: false },
    twoFactorAttempts: { type: Number, select: false },
    twoFactorNextCodeAt: { type: Date, select: false },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

export const UserModel = model<User>("User", userSchema);
