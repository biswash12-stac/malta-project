import mongoose from "mongoose";
import { env } from "./env.js";
import { logger } from "../utils/logger.js";

const redactMongoUri = (s: string): string =>
  s.replace(/mongodb(\+srv)?:\/\/[^@\s]+@/gi, "mongodb://***@");

export const connectDB = async (): Promise<void> => {
  mongoose.set("strictQuery", true);

  mongoose.connection.on("connected", () => logger.info("MongoDB connected"));
  mongoose.connection.on("disconnected", () => logger.warn("MongoDB disconnected"));
  mongoose.connection.on("error", (err) => {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error(`MongoDB error: ${redactMongoUri(msg)}`);
  });

  try {
    await mongoose.connect(env.MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
      maxPoolSize: 10,
      bufferCommands: false,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error(`MongoDB initial connection failed: ${redactMongoUri(msg)}`);
    process.exit(1);
  }

  // Mongoose builds indexes in the background and hides failures. Without a unique index, duplicate
  // emails and slugs would be accepted without any warning, so never run without them.
  try {
    await Promise.all(Object.values(mongoose.models).map((model) => model.init()));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error(`Could not build database indexes: ${redactMongoUri(msg)}`);
    process.exit(1);
  }
};
