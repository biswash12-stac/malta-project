import { createHash, randomBytes } from "node:crypto";
import jwt from "jsonwebtoken";
import { env } from "../../config/env.js";
import { AppError } from "../../utils/app-error.js";
import { UserModel, type UserDocument } from "../users/user.model.js";
import { bumpTokenVersion } from "../users/user.service.js";
import { RefreshSessionModel } from "./refresh-session.model.js";

export const ACCESS_SECONDS = 15 * 60;
export const REFRESH_SECONDS = 7 * 24 * 60 * 60;
export const PENDING_LOGIN_SECONDS = 10 * 60;

// Two open tabs can refresh at the same moment, which shouldn't look like theft.
const REUSE_GRACE_MS = 10_000;

// `use` stops a token made for one job, such as a pending 2FA login, being accepted for another.
type TokenUse = "access" | "pending-2fa";

const signToken = (user: UserDocument, use: TokenUse, expiresIn: number): string =>
  jwt.sign({ use, ver: user.tokenVersion }, env.JWT_SECRET, {
    algorithm: "HS256",
    subject: user.id,
    expiresIn,
  });

export const signPendingLoginToken = (user: UserDocument): string =>
  signToken(user, "pending-2fa", PENDING_LOGIN_SECONDS);

// Throws 401 on a bad, expired or tampered token, or one made for another job.
export const verifyToken = (
  token: string,
  use: TokenUse
): { userId: string; tokenVersion: number } => {
  try {
    const payload = jwt.verify(token, env.JWT_SECRET, { algorithms: ["HS256"] });
    if (
      typeof payload === "string" ||
      !payload.sub ||
      typeof payload.ver !== "number" ||
      payload.use !== use
    ) {
      throw new Error("Token is not valid for this use");
    }
    return { userId: payload.sub, tokenVersion: payload.ver };
  } catch {
    throw AppError.unauthorized();
  }
};

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

export type SessionTokens = { accessToken: string; refreshToken: string };

export const createSession = async (user: UserDocument): Promise<SessionTokens> => {
  const refreshToken = randomBytes(32).toString("hex");
  await RefreshSessionModel.create({
    user: user._id,
    tokenHash: hashToken(refreshToken),
    tokenVersion: user.tokenVersion,
    expiresAt: new Date(Date.now() + REFRESH_SECONDS * 1000),
  });
  return { accessToken: signToken(user, "access", ACCESS_SECONDS), refreshToken };
};

// Ends every session of this user, and any access token still in circulation.
export const revokeAllSessions = async (userId: string, tokenVersion: number): Promise<void> => {
  const { modifiedCount } = await bumpTokenVersion(userId, tokenVersion);
  if (modifiedCount > 0) await RefreshSessionModel.deleteMany({ user: userId });
};

// Returns a new access token, and a new refresh token unless another request already rotated it.
export const refreshSession = async (
  refreshToken: string
): Promise<{ user: UserDocument; accessToken: string; refreshToken?: string }> => {
  const session = await RefreshSessionModel.findOne({ tokenHash: hashToken(refreshToken) });
  // MongoDB's clean-up of expired rows can lag, so check the time here too.
  if (!session || session.expiresAt.getTime() <= Date.now()) throw AppError.unauthorized();

  const user = await UserModel.findById(session.user);
  if (!user || user.tokenVersion !== session.tokenVersion) throw AppError.unauthorized();

  const accessOnly = () => ({ user, accessToken: signToken(user, "access", ACCESS_SECONDS) });

  if (session.replacedAt) {
    if (Date.now() - session.replacedAt.getTime() <= REUSE_GRACE_MS) return accessOnly();
    // A replaced token came back: either the owner or a thief holds a stolen copy. End everything.
    await revokeAllSessions(user.id, user.tokenVersion);
    throw AppError.unauthorized();
  }

  const claimed = await RefreshSessionModel.findOneAndUpdate(
    { _id: session._id, replacedAt: null },
    { replacedAt: new Date() }
  );
  if (!claimed) return accessOnly();
  return { user, ...(await createSession(user)) };
};

// Used by logout. Returns the session's owner even if the access token has already expired.
export const findSessionOwner = async (refreshToken: string) => {
  const session = await RefreshSessionModel.findOne({ tokenHash: hashToken(refreshToken) })
    .select("user tokenVersion")
    .lean();
  return session && { userId: session.user.toString(), tokenVersion: session.tokenVersion };
};
