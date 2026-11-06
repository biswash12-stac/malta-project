import bcrypt from "bcryptjs";
import { AppError } from "../../utils/app-error.js";
import type { UserDocument } from "../users/user.model.js";
import {
  createUser,
  findUserByEmailWithPassword,
  toPublicUser,
  type PublicUser,
} from "../users/user.service.js";
import type { LoginInput, RegisterInput } from "./auth.schema.js";
import { loginWithGoogle } from "./google.service.js";
import {
  createSession,
  findSessionOwner,
  revokeAllSessions,
  signPendingLoginToken,
  verifyToken,
  type SessionTokens,
} from "./session.service.js";
import { sendCode, validateLogin } from "./two-factor.service.js";

export const BCRYPT_COST = 12;

// Compared against when the email is unknown or has no password, so every login failure
// takes the same time and response timing can't reveal which emails have accounts.
const DUMMY_HASH = bcrypt.hashSync("no-such-user", BCRYPT_COST);

export type LoginResult =
  { requires2FA: true; pendingToken: string } | ({ user: PublicUser } & SessionTokens);

const startSession = async (user: UserDocument): Promise<LoginResult> => ({
  user: toPublicUser(user),
  ...(await createSession(user)),
});

// The one place a password or Google login turns into a session, so neither can skip 2FA.
const completeLogin = async (user: UserDocument): Promise<LoginResult> => {
  if (!user.twoFactorEnabled) return startSession(user);
  await sendCode(user);
  return { requires2FA: true, pendingToken: signPendingLoginToken(user) };
};

export const register = async ({ password, ...profile }: RegisterInput): Promise<LoginResult> => {
  const passwordHash = await bcrypt.hash(password, BCRYPT_COST);
  try {
    return await startSession(await createUser({ ...profile, passwordHash }));
  } catch (err) {
    // Rely on the unique index, not a prior lookup: two parallel signups can't both pass.
    if ((err as { code?: number }).code === 11000) {
      throw AppError.conflict("Email is already registered");
    }
    throw err;
  }
};

export const login = async ({ email, password }: LoginInput): Promise<LoginResult> => {
  const user = await findUserByEmailWithPassword(email);
  const matches = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);
  if (!user?.passwordHash || !matches) throw AppError.unauthorized("Invalid email or password");
  return completeLogin(user);
};

export const googleLogin = async (credential: string): Promise<LoginResult> =>
  completeLogin(await loginWithGoogle(credential));

export const finishTwoFactorLogin = async (
  pendingToken: unknown,
  code: string
): Promise<LoginResult> => startSession(await validateLogin(pendingToken, code));

// Ends every session of the user behind these cookies. Bad or expired cookies have nothing to end.
export const logout = async (accessToken: unknown, refreshToken: unknown): Promise<void> => {
  if (typeof refreshToken === "string") {
    const owner = await findSessionOwner(refreshToken);
    if (owner) {
      await revokeAllSessions(owner.userId, owner.tokenVersion);
      return;
    }
  }
  if (typeof accessToken !== "string") return;
  try {
    const { userId, tokenVersion } = verifyToken(accessToken, "access");
    await revokeAllSessions(userId, tokenVersion);
  } catch (err) {
    if (!(err instanceof AppError)) throw err;
  }
};
