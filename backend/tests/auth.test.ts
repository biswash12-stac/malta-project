import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { after, before, test } from "node:test";
import { promisify } from "node:util";
import express from "express";
import cookieParser from "cookie-parser";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";

let mongo: MongoMemoryServer;
let server: Server;
let adminCheckServer: Server;
let base: string;
let adminCheckUrl: string;
let UserModel: typeof import("../src/modules/users/user.model.js").UserModel;

const customer = {
  username: "Sita Rai",
  email: "sita@example.com",
  password: "correct-horse-battery",
};

const post = (path: string, body: unknown) =>
  fetch(base + path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });

const authCookie = (res: Response) => res.headers.getSetCookie()[0]?.split(";")[0] ?? "";

const listen = (app: express.Express) =>
  new Promise<Server>((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });

const urlOf = (s: Server) => `http://127.0.0.1:${(s.address() as AddressInfo).port}`;

before(async () => {
  mongo = await MongoMemoryServer.create();
  // Set before the app loads, so tests can never touch the database in .env.
  process.env.MONGODB_URI = mongo.getUri("test");
  process.env.JWT_SECRET = "test-secret-".repeat(4);
  process.env.NODE_ENV = "test";
  process.env.LOG_LEVEL = "fatal";

  const { app } = await import("../src/app.js");
  const { connectDB } = await import("../src/config/db.js");
  const { requireAuth } = await import("../src/middlewares/auth.middleware.js");
  const { requireRole } = await import("../src/middlewares/role.middleware.js");
  const { errorHandler } = await import("../src/middlewares/error.middleware.js");
  ({ UserModel } = await import("../src/modules/users/user.model.js"));

  await connectDB();
  server = await listen(app);
  base = urlOf(server);

  const adminCheck = express();
  adminCheck.use(cookieParser());
  adminCheck.get("/", requireAuth, requireRole("admin"), (_req, res) => {
    res.json({ ok: true });
  });
  adminCheck.use(errorHandler);
  adminCheckServer = await listen(adminCheck);
  adminCheckUrl = urlOf(adminCheckServer);
});

after(async () => {
  server.close();
  adminCheckServer.close();
  await mongoose.disconnect();
  await mongo.stop();
});

test("register creates a customer, sets a safe cookie, never returns the hash", async () => {
  const res = await post("/api/v1/auth/register", { ...customer, role: "admin" });
  assert.equal(res.status, 201);

  const raw = await res.text();
  assert.ok(!raw.includes("passwordHash"));
  assert.ok(!raw.includes(customer.password));
  assert.equal(JSON.parse(raw).data.user.role, "customer");

  const cookie = res.headers.getSetCookie()[0] ?? "";
  assert.match(cookie, /^auth_token=/);
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /SameSite=Lax/);
});

test("the same email in another case is rejected", async () => {
  const res = await post("/api/v1/auth/register", { ...customer, email: "SITA@example.com" });
  assert.equal(res.status, 409);
});

test("parallel signups with one email create one account", async () => {
  const body = { ...customer, email: "race@example.com" };
  const results = await Promise.all([
    post("/api/v1/auth/register", body),
    post("/api/v1/auth/register", body),
  ]);
  assert.deepEqual(results.map((r) => r.status).sort(), [201, 409]);
  assert.equal(await UserModel.countDocuments({ email: body.email }), 1);
});

test("register rejects weak input with field errors", async () => {
  const res = await post("/api/v1/auth/register", { ...customer, password: "short" });
  assert.equal(res.status, 400);
  const { error } = await res.json();
  assert.equal(error.code, "VALIDATION_ERROR");
  assert.ok(error.details.password);
});

test("login failures look the same for a wrong password and an unknown email", async () => {
  const wrong = await post("/api/v1/auth/login", { email: customer.email, password: "nope" });
  const unknown = await post("/api/v1/auth/login", { email: "no@example.com", password: "nope" });
  assert.equal(wrong.status, 401);
  assert.equal(unknown.status, 401);
  assert.deepEqual(await wrong.json(), await unknown.json());
});

test("login, me and logout work as one session", async () => {
  const login = await post("/api/v1/auth/login", {
    email: customer.email,
    password: customer.password,
  });
  assert.equal(login.status, 200);

  const me = await fetch(`${base}/api/v1/auth/me`, { headers: { cookie: authCookie(login) } });
  assert.equal(me.status, 200);
  assert.equal((await me.json()).data.user.email, customer.email);

  const logout = await post("/api/v1/auth/logout", {});
  assert.match(logout.headers.getSetCookie()[0] ?? "", /^auth_token=;/);
});

test("me rejects a missing or tampered token", async () => {
  assert.equal((await fetch(`${base}/api/v1/auth/me`)).status, 401);

  const login = await post("/api/v1/auth/login", {
    email: customer.email,
    password: customer.password,
  });
  const tampered = `${authCookie(login).slice(0, -2)}xx`;
  const res = await fetch(`${base}/api/v1/auth/me`, { headers: { cookie: tampered } });
  assert.equal(res.status, 401);
});

test("requireRole blocks customers, and a role change applies to existing tokens", async () => {
  const login = await post("/api/v1/auth/login", {
    email: customer.email,
    password: customer.password,
  });
  const headers = { cookie: authCookie(login) };

  assert.equal((await fetch(adminCheckUrl)).status, 401);
  assert.equal((await fetch(adminCheckUrl, { headers })).status, 403);

  await UserModel.updateOne({ email: customer.email }, { role: "admin" });
  assert.equal((await fetch(adminCheckUrl, { headers })).status, 200);
  await UserModel.updateOne({ email: customer.email }, { role: "customer" });
});

test("seed script creates an admin who can log in, and is safe to re-run", async () => {
  const run = () =>
    promisify(execFile)(process.execPath, ["--import", "tsx", "src/scripts/seed-admin.ts"], {
      env: {
        ...process.env,
        ADMIN_USERNAME: "Owner",
        ADMIN_EMAIL: "owner@example.com",
        ADMIN_PASSWORD: "owner-password-123",
      },
    });
  await run();
  await run();

  assert.equal(await UserModel.countDocuments({ email: "owner@example.com" }), 1);
  const res = await post("/api/v1/auth/login", {
    email: "owner@example.com",
    password: "owner-password-123",
  });
  assert.equal(res.status, 200);
  assert.equal((await res.json()).data.user.role, "admin");
});

test("client mistakes return 4xx, not 500", async () => {
  assert.equal((await post("/api/v1/auth/logout", "{bad")).status, 400);
  const big = await post("/api/v1/auth/logout", { a: "x".repeat(20_000) });
  assert.equal(big.status, 413);
  assert.equal((await big.json()).error.code, "BAD_REQUEST");
});

test("a model validation error returns 400", async () => {
  const { errorHandler } = await import("../src/middlewares/error.middleware.js");
  const invalid = await new UserModel({}).validate().catch((err: unknown) => err);
  let status = 0;
  const res = {
    status(code: number) {
      status = code;
      return this;
    },
    json() {
      return this;
    },
  };
  errorHandler(invalid, { originalUrl: "/", method: "POST" } as never, res as never, () => {});
  assert.equal(status, 400);
});

// Keep last: it uses up the limit for the rest of this process.
test("auth routes are rate limited", async () => {
  let last = 0;
  for (let i = 0; i < 25 && last !== 429; i++) {
    // A different fake IP each time: without a proxy configured, this must not reset the count.
    const headers = { "content-type": "application/json", "x-forwarded-for": `10.0.0.${i}` };
    const res = await fetch(`${base}/api/v1/auth/login`, { method: "POST", headers, body: "{}" });
    last = res.status;
  }
  assert.equal(last, 429);
  const res = await post("/api/v1/auth/login", {});
  assert.equal((await res.json()).error.code, "RATE_LIMITED");
});
