/**
 * Creates the admin account, the only way to get one (SRS FR-3).
 * Safe to re-run: it also resets the admin's password, since v1 has no reset flow.
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

  await connectDB();
  await UserModel.findOneAndUpdate(
    { email: profile.email },
    {
      ...profile,
      passwordHash: await bcrypt.hash(password, BCRYPT_COST),
      role: "admin",
    },
    { upsert: true, runValidators: true }
  );
  logger.info(`Admin ready: ${profile.email}`);
};

seed()
  .catch((err) => {
    logger.error({ msg: "Admin seed failed", err: String(err) });
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
