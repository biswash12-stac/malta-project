import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { env } from "../../config/env.js";
import { AppError } from "../../utils/app-error.js";
import type { UserDocument } from "../users/user.model.js";
import {
  createUser,
  findUserByEmailWithPassword,
  revokeSessions,
  toPublicUser,
} from "../users/user.service.js";
import type { LoginInput, RegisterInput } from "./auth.schema.js";

export const BCRYPT_COST = 12;
export const SESSION_SECONDS = 7 * 24 * 60 * 60;

// Compared against when the email is unknown, so both login failures take the same time
// and response timing can't reveal which emails have accounts.
const DUMMY_HASH = bcrypt.hashSync("no-such-user", BCRYPT_COST);

const signToken = (user: UserDocument): string =>
  jwt.sign({ ver: user.tokenVersion }, env.JWT_SECRET, {
    algorithm: "HS256",
    subject: user.id,
    expiresIn: SESSION_SECONDS,
  });

// Throws 401 on a bad, expired or tampered token.
export const verifyToken = (token: string): { userId: string; tokenVersion: number } => {
  try {
    const payload = jwt.verify(token, env.JWT_SECRET, { algorithms: ["HS256"] });
    if (typeof payload === "string" || !payload.sub || typeof payload.ver !== "number") {
      throw new Error("Token is missing a claim");
    }
    return { userId: payload.sub, tokenVersion: payload.ver };
  } catch {
    throw AppError.unauthorized();
  }
};

const session = (user: UserDocument) => ({ user: toPublicUser(user), token: signToken(user) });

export const register = async ({ password, ...profile }: RegisterInput) => {
  const passwordHash = await bcrypt.hash(password, BCRYPT_COST);
  try {
    return session(await createUser({ ...profile, passwordHash }));
  } catch (err) {
    // Rely on the unique index, not a prior lookup: two parallel signups can't both pass.
    if ((err as { code?: number }).code === 11000) {
      throw AppError.conflict("Email is already registered");
    }
    throw err;
  }
};

export const login = async ({ email, password }: LoginInput) => {
  const user = await findUserByEmailWithPassword(email);
  const matches = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !matches) throw AppError.unauthorized("Invalid email or password");
  return session(user);
};

// Ends every session of this token's user. A bad or expired token has nothing to end.
export const logout = async (token: unknown): Promise<void> => {
  if (typeof token !== "string") return;
  try {
    const { userId, tokenVersion } = verifyToken(token);
    await revokeSessions(userId, tokenVersion);
  } catch (err) {
    if (!(err instanceof AppError)) throw err;
  }
};
