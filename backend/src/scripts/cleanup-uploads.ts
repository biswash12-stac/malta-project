/**
 * Runs the abandoned-upload cleanup once: deletes uploads the server signed but no product saved
 * within 24 hours. The API also runs this every hour; use this for a manual or host-cron run.
 * Exits with code 1 if any file could not be deleted, so a scheduler notices.
 */
import mongoose from "mongoose";
import { connectDB } from "../config/db.js";
import { runUploadCleanup } from "../modules/uploads/upload-cleanup.js";
import { logger } from "../utils/logger.js";

const main = async (): Promise<void> => {
  await connectDB();
  try {
    const result = await runUploadCleanup();
    console.log(JSON.stringify(result));
    if (result.status === "partial") process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
};

main().catch((err: unknown) => {
  logger.error({ msg: "Upload cleanup failed", err: String(err) });
  process.exit(1);
});
