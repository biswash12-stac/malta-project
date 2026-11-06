import { createHash, randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { env } from "../../config/env.js";
import { AppError } from "../../utils/app-error.js";
import { logger } from "../../utils/logger.js";
import { mailer } from "../../utils/mailer.js";
import { UserModel } from "../users/user.model.js";
import { BCRYPT_COST } from "./auth.service.js";
import { RefreshSessionModel } from "./refresh-session.model.js";

const RESET_MS = 30 * 60 * 1000;

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

const sendResetEmail = async (email: string): Promise<void> => {
  const token = randomBytes(32).toString("hex");
  const user = await UserModel.findOneAndUpdate(
    { email },
    { passwordResetToken: hashToken(token), passwordResetExpires: new Date(Date.now() + RESET_MS) }
  );
  if (!user) return;

  await mailer.send({
    to: user.email,
    subject: "Reset your password",
    text: `Use this link to choose a new password. It expires in 30 minutes.\n\n${env.CLIENT_URL}/reset-password?token=${token}\n\nIf you didn't ask for this, you can ignore this email.`,
  });
};

// Runs in the background, so the response and its timing are the same whether or not
// the account exists, and a failed email can't reveal it either.
export const requestPasswordReset = (email: string): void => {
  sendResetEmail(email).catch((err: unknown) => {
    logger.error({ msg: "Password reset email failed", err: String(err) });
  });
};

export const resetPassword = async (token: string, password: string): Promise<void> => {
  const passwordHash = await bcrypt.hash(password, BCRYPT_COST);

  // One atomic update, so a token can only ever be used once.
  const user = await UserModel.findOneAndUpdate(
    { passwordResetToken: hashToken(token), passwordResetExpires: { $gt: new Date() } },
    {
      $set: { passwordHash, emailVerified: true },
      $unset: { passwordResetToken: "", passwordResetExpires: "" },
      $inc: { tokenVersion: 1 },
    }
  );
  if (!user) {
    throw AppError.badRequest("Invalid input", { token: ["Invalid or expired link"] });
  }
  await RefreshSessionModel.deleteMany({ user: user._id });
};
