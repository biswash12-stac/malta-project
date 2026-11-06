import { createHmac, randomInt, timingSafeEqual } from "node:crypto";
import { env } from "../../config/env.js";
import { AppError } from "../../utils/app-error.js";
import { mailer } from "../../utils/mailer.js";
import { UserModel, type UserDocument } from "../users/user.model.js";
import { verifyToken } from "./session.service.js";

const CODE_MS = 10 * 60 * 1000;
const RESEND_MS = 60 * 1000;
const LOCK_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 5;

const hashCode = (userId: string, code: string) =>
  createHmac("sha256", env.TWO_FACTOR_SECRET).update(`${userId}:${code}`).digest("hex");

const invalidCode = () =>
  AppError.badRequest("Invalid input", { code: ["Invalid or expired code"] });

// Sends nothing while the resend wait or a lock is running; the earlier code stays valid.
export const sendCode = async (user: UserDocument): Promise<void> => {
  const code = randomInt(0, 1_000_000).toString().padStart(6, "0");
  const now = Date.now();

  const { modifiedCount } = await UserModel.updateOne(
    {
      _id: user._id,
      $or: [{ twoFactorNextCodeAt: null }, { twoFactorNextCodeAt: { $lte: new Date(now) } }],
    },
    {
      twoFactorCode: hashCode(user.id, code),
      twoFactorExpires: new Date(now + CODE_MS),
      twoFactorAttempts: 0,
      twoFactorNextCodeAt: new Date(now + RESEND_MS),
    }
  );
  if (modifiedCount === 0) return;

  try {
    await mailer.send({
      to: user.email,
      subject: "Your verification code",
      text: `Your verification code is ${code}. It expires in 10 minutes. If you didn't ask for it, change your password.`,
    });
  } catch {
    // Let the user try again straight away instead of waiting out the resend limit.
    await UserModel.updateOne({ _id: user._id }, { twoFactorNextCodeAt: null });
    throw new AppError(503, "EMAIL_FAILED", "Could not send the code, please try again");
  }
};

// Each code works once. After too many wrong tries it's cancelled and new codes are held back,
// so even someone with the password only gets a handful of guesses per lock period.
const checkCode = async (userId: string, code: string): Promise<UserDocument> => {
  const user = await UserModel.findById(userId).select("+twoFactorCode +twoFactorExpires");
  if (!user?.twoFactorCode || !user.twoFactorExpires) throw invalidCode();
  if (user.twoFactorExpires.getTime() <= Date.now()) throw invalidCode();
  const storedCode = user.twoFactorCode;

  // Counted in the database first, so parallel guesses can't exceed the limit.
  const counted = await UserModel.findOneAndUpdate(
    { _id: userId, twoFactorCode: storedCode, twoFactorAttempts: { $lt: MAX_ATTEMPTS } },
    { $inc: { twoFactorAttempts: 1 } },
    { returnDocument: "after" }
  ).select("+twoFactorAttempts");
  if (!counted) throw invalidCode();

  const matches = timingSafeEqual(
    Buffer.from(hashCode(userId, code), "hex"),
    Buffer.from(storedCode, "hex")
  );
  if (!matches) {
    if ((counted.twoFactorAttempts ?? 0) >= MAX_ATTEMPTS) {
      await UserModel.updateOne(
        { _id: userId },
        {
          $unset: { twoFactorCode: "", twoFactorExpires: "" },
          $set: { twoFactorNextCodeAt: new Date(Date.now() + LOCK_MS) },
        }
      );
    }
    throw invalidCode();
  }

  const { modifiedCount } = await UserModel.updateOne(
    { _id: userId, twoFactorCode: storedCode },
    { $unset: { twoFactorCode: "", twoFactorExpires: "" } }
  );
  if (modifiedCount === 0) throw invalidCode();
  return user;
};

const findUserOr401 = async (userId: string) => {
  const user = await UserModel.findById(userId);
  if (!user) throw AppError.unauthorized();
  return user;
};

export const requestEnable = async (userId: string): Promise<void> => {
  const user = await findUserOr401(userId);
  if (user.twoFactorEnabled) throw AppError.conflict("Two-factor login is already on");
  await sendCode(user);
};

export const confirmEnable = async (userId: string, code: string): Promise<void> => {
  const user = await findUserOr401(userId);
  if (user.twoFactorEnabled) throw AppError.conflict("Two-factor login is already on");
  await checkCode(userId, code);
  // The code reached this inbox, so this also proves the email address is theirs.
  await UserModel.updateOne({ _id: userId }, { twoFactorEnabled: true, emailVerified: true });
};

export const requestDisable = async (userId: string): Promise<void> => {
  const user = await findUserOr401(userId);
  if (!user.twoFactorEnabled) throw AppError.conflict("Two-factor login is already off");
  await sendCode(user);
};

export const confirmDisable = async (userId: string, code: string): Promise<void> => {
  const user = await findUserOr401(userId);
  if (!user.twoFactorEnabled) throw AppError.conflict("Two-factor login is already off");
  await checkCode(userId, code);
  await UserModel.updateOne({ _id: userId }, { twoFactorEnabled: false });
};

// Finishes a login that passed the password or Google step. Returns the user to start a session for.
export const validateLogin = async (pendingToken: unknown, code: string): Promise<UserDocument> => {
  const expired = AppError.badRequest("Login expired, please log in again");
  if (typeof pendingToken !== "string") throw expired;

  let pending: ReturnType<typeof verifyToken>;
  try {
    pending = verifyToken(pendingToken, "pending-2fa");
  } catch {
    throw expired;
  }

  const user = await UserModel.findById(pending.userId);
  if (!user?.twoFactorEnabled || user.tokenVersion !== pending.tokenVersion) throw expired;

  await checkCode(user.id, code);
  return user;
};
