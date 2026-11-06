import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { env } from "../../config/env.js";
import { AppError } from "../../utils/app-error.js";
import { createUser, findUserByEmailWithPassword, toPublicUser } from "../users/user.service.js";
import type { LoginInput, RegisterInput } from "./auth.schema.js";

export const BCRYPT_COST = 12;
export const SESSION_SECONDS = 7 * 24 * 60 * 60;

// Compared against when the email is unknown, so both login failures take the same time
// and response timing can't reveal which emails have accounts.
const DUMMY_HASH = bcrypt.hashSync("no-such-user", BCRYPT_COST);

export const signToken = (userId: string): string =>
  jwt.sign({}, env.JWT_SECRET, {
    algorithm: "HS256",
    subject: userId,
    expiresIn: SESSION_SECONDS,
  });

// Returns the user id. Throws 401 on a bad, expired or tampered token.
export const verifyToken = (token: string): string => {
  try {
    const { sub } = jwt.verify(token, env.JWT_SECRET, { algorithms: ["HS256"] });
    if (typeof sub !== "string") throw new Error("Token has no subject");
    return sub;
  } catch {
    throw AppError.unauthorized();
  }
};

export const register = async ({ password, ...profile }: RegisterInput) => {
  const passwordHash = await bcrypt.hash(password, BCRYPT_COST);
  try {
    const user = await createUser({ ...profile, passwordHash });
    return toPublicUser(user);
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
  return toPublicUser(user);
};
