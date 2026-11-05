/**
 * cleanEnv validates our environment variables.
 * str checks that a value is a string.
 * port checks that a value is a valid port number.
 * url checks that a value is a valid URL.
 */
import "dotenv/config";

import { cleanEnv, str, port, url, makeValidator } from "envalid";

// Custom validator: only accepts mongodb:// or mongodb+srv:// URLs
const mongoUri = makeValidator<string>((input) => {
  if (input.startsWith("mongodb://") || input.startsWith("mongodb+srv://")) {
    return input;
  }
  throw new Error("MONGODB_URI must start with mongodb:// or mongodb+srv://");
});

export const env = cleanEnv(process.env, {
  // node env: development | test | production
  NODE_ENV: str({
    choices: ["development", "test", "production"],
    default: "development",
  }),

  // if port is not provided, assume 4000
  PORT: port({
    default: 4000,
  }),

  // MongoDB connection string, must start with mongodb:// or mongodb+srv://
  MONGODB_URI: mongoUri(),

  CLIENT_URL: url({
    default: "http://localhost:3000",
  }),

  LOG_LEVEL: str({
    choices: ["trace", "debug", "info", "warn", "error", "fatal"],
    default: "info",
  }),
});