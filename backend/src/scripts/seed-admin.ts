/**
 * Creates the admin account, the only way to get one (SRS FR-3).
 * Safe to re-run on an admin: it resets their password and ends their sessions,
 * since v1 has no reset flow. It refuses an email that belongs to a customer.
 * Needs ADMIN_USERNAME, ADMIN_EMAIL and ADMIN_PASSWORD in the environment.
 */
import bcrypt from "bcryptjs";
import { cleanEnv, str } from "envalid";
import mongoose from "mongoose";
import { connectDB } from "../config/db.js";
import { BCRYPT_COST } from "../modules/auth/auth.service.js";
import { registerSchema } from "../modules/auth/auth.schema.js";
import { UserModel } from "../modules/users/user.model.js";
import { logger } from "../utils/logger.js";

const MIN_ADMIN_PASSWORD_LENGTH = 12;

const adminEnv = cleanEnv(process.env, {
  ADMIN_USERNAME: str(),
  ADMIN_EMAIL: str(),
  ADMIN_PASSWORD: str(),
});

const seed = async (): Promise<void> => {
  const { password, ...profile } = registerSchema.parse({
    username: adminEnv.ADMIN_USERNAME,
    email: adminEnv.ADMIN_EMAIL,
    password: adminEnv.ADMIN_PASSWORD,
  });
  if (password.length < MIN_ADMIN_PASSWORD_LENGTH) {
    throw new Error(`ADMIN_PASSWORD must be at least ${MIN_ADMIN_PASSWORD_LENGTH} characters`);
  }

  await connectDB();
  try {
    // Matches admins only. A customer with this email makes the insert hit the unique index,
    // so someone who registered the owner's email first can't be promoted, even in a race.
    await UserModel.findOneAndUpdate(
      { email: profile.email, role: "admin" },
      {
        $set: {
          username: profile.username,
          passwordHash: await bcrypt.hash(password, BCRYPT_COST),
        },
        $inc: { tokenVersion: 1 },
      },
      { upsert: true, runValidators: true }
    );
  } catch (err) {
    if ((err as { code?: number }).code === 11000) {
      throw new Error(`${profile.email} belongs to a customer account. Use a different email.`);
    }
    throw err;
  }
  logger.info(`Admin ready: ${profile.email}`);
};

seed()
  .catch((err) => {
    logger.error({ msg: "Admin seed failed", err: String(err) });
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
