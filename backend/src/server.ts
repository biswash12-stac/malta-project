import { app } from "./app.js";
import { env } from "./config/env.js";
import { connectDB } from "./config/db.js";
import { logger } from "./utils/logger.js";
import mongoose from "mongoose";

const start = async (): Promise<void> => {
  // 1. Connect DB first. If it fails, process exits — never listen without DB.
  await connectDB();

  // 2. Bind the port.
  const server = app.listen(env.PORT, (err?: Error) => {
    // Express 5 also calls this when binding fails, e.g. the port is already in use.
    if (err) {
      logger.error(`Could not listen on port ${env.PORT}: ${err.message}`);
      process.exit(1);
    }
    logger.info(`Server listening on http://localhost:${env.PORT} (${env.NODE_ENV})`);
  });

  // 3. Graceful shutdown.
  //    Render sends SIGTERM before killing the process. We close the HTTP server
  //    (stop accepting new requests), then close the DB (finish in-flight writes),
  //    then exit. If we don't do this, in-flight orders/stock decrements can be
  //    killed mid-write during redeploys.
  const shutdown = async (signal: string): Promise<void> => {
    logger.info(`${signal} received — shutting down`);

    server.close(async () => {
      try {
        await mongoose.connection.close();
        logger.info("Shutdown complete");
        process.exit(0);
      } catch (err) {
        logger.error({ msg: "Error during shutdown", err: String(err) });
        process.exit(1);
      }
    });

    // Hard kill if graceful shutdown takes too long
    setTimeout(() => {
      logger.error("Forced shutdown after 10s");
      process.exit(1);
    }, 10_000).unref();
  };

  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));

  // Fail loudly on unhandled rejections instead of silently hanging
  process.on("unhandledRejection", (reason) => {
    logger.error({ msg: "Unhandled promise rejection", reason: String(reason) });
    process.exit(1);
  });

  process.on("uncaughtException", (err) => {
    logger.error({ msg: "Uncaught exception", err: err.message, stack: err.stack });
    process.exit(1);
  });
};

void start();
