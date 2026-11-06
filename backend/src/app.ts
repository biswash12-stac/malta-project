import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";

import { env } from "./config/env.js";
import { logger } from "./utils/logger.js";
import { router } from "./routes.js";
import { errorHandler, notFoundHandler } from "./middlewares/error.middleware.js";
import { generalRateLimit } from "./middlewares/rate-limit.middleware.js";

export const app = express();

// Number of reverse proxies in front of the API (Render, Railway, nginx) — required for correct client IPs,
// which matters for rate limiting and logs.
app.set("trust proxy", env.TRUST_PROXY_HOPS);

// Security headers. CSP is not configured yet — tune in Phase 8.
app.use(helmet());

// CORS: only your friend's frontend origin, with cookies.
app.use(
  cors({
    origin: env.CLIENT_URL,
    credentials: true,
    methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
  })
);

// Structured request logging. Silences health checks to avoid log spam.
app.use(
  pinoHttp({
    logger,
    autoLogging: {
      ignore: (req) => req.url === "/api/v1/health",
    },
    // Don't dump full headers — they can include cookies.
    serializers: {
      req: (req) => ({ method: req.method, url: req.url }),
      res: (res) => ({ statusCode: res.statusCode }),
    },
  })
);

// After CORS, so a blocked browser still gets a readable 429. Before body parsing, to save the work.
app.use(generalRateLimit);

// Body parsing. Limit is small on purpose — our API never accepts large bodies.
// JSON only: browsers can post HTML forms from any site, but not JSON without passing CORS.
app.use(express.json({ limit: "10kb" }));

// Cookies (used for JWT auth cookie, later).
app.use(cookieParser());

// All routes under /api/v1
app.use("/api/v1", router);

// 404 for anything that fell through
app.use(notFoundHandler);

// Global error handler — must be last
app.use(errorHandler);
