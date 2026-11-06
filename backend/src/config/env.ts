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

// A short secret can be guessed offline from any token, which would allow forging admin logins.
const jwtSecret = makeValidator<string>((input) => {
  if (input.length >= 32) return input;
  throw new Error("JWT_SECRET must be at least 32 characters");
});

const proxyHops = makeValidator<number>((input) => {
  const hops = Number(input);
  if (Number.isInteger(hops) && hops >= 0) return hops;
  throw new Error("TRUST_PROXY_HOPS must be a whole number, 0 or more");
});

export const env = cleanEnv(process.env, {
  // No default: if this were forgotten on a server, it would run with production protections off.
  NODE_ENV: str({
    choices: ["development", "test", "production"],
  }),

  // if port is not provided, assume 4000
  PORT: port({
    default: 4000,
  }),

  // MongoDB connection string, must start with mongodb:// or mongodb+srv://
  MONGODB_URI: mongoUri(),

  JWT_SECRET: jwtSecret(),

  // How many proxies sit in front of the API. Too high lets clients fake their IP and dodge
  // rate limits; too low puts all users under one limit. Required in production.
  TRUST_PROXY_HOPS: proxyHops({
    devDefault: 0,
  }),

  // devDefault: required in production, so a missing value stops startup instead of breaking CORS
  CLIENT_URL: url({
    devDefault: "http://localhost:3000",
  }),

  // Production only, e.g. .example.com, so Next.js on the main domain can see the API's cookie
  COOKIE_DOMAIN: str({
    default: undefined,
  }),

  LOG_LEVEL: str({
    choices: ["trace", "debug", "info", "warn", "error", "fatal"],
    default: "info",
  }),
});
