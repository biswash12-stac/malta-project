/**
 * Development only: inserts 100 placeholder products in 14 categories (see dev-catalog/).
 * Safe to re-run: it only inserts what is missing, matched by slug, and never updates or deletes.
 * Refuses to run when NODE_ENV=production. Exits with code 1 if anything failed or the
 * database does not end up with all 100 seed products.
 */
import mongoose from "mongoose";
import { connectDB } from "../config/db.js";
import { env } from "../config/env.js";
import { logger } from "../utils/logger.js";
import { seedDevCatalog } from "./dev-catalog/seed-dev-catalog.js";

const main = async (): Promise<void> => {
  if (env.isProduction) {
    logger.error("Refusing to seed the development catalogue: NODE_ENV is production");
    process.exit(1);
  }
  await connectDB();
  try {
    const summary = await seedDevCatalog();
    console.log(JSON.stringify(summary, null, 2));
    if (
      summary.products.failed > 0 ||
      summary.seedProductsInDatabase !== summary.expectedSeedProducts
    ) {
      process.exitCode = 1;
    }
  } finally {
    await mongoose.disconnect();
  }
};

main().catch((err: unknown) => {
  logger.error({ msg: "Development seed failed", err: String(err) });
  process.exit(1);
});
