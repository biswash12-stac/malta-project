import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { after, before, test } from "node:test";
import { promisify } from "node:util";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";

let mongo: MongoMemoryServer;
let server: Server;
let base: string;
let UserModel: typeof import("../src/modules/users/user.model.js").UserModel;

const PASSWORD = "password-123";

const post = (path: string, body: unknown, cookie?: string) =>
  fetch(`${base}/api/v1/auth/${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", ...(cookie && { cookie }) },
    body: JSON.stringify(body),
  });

const cookieOf = (res: Response) => res.headers.getSetCookie()[0]?.split(";")[0] ?? "";

const register = async (email: string) => {
  const res = await post("register", { username: "Test", email, password: PASSWORD });
  assert.equal(res.status, 201);
  return cookieOf(res);
};

const login = async (email: string, password = PASSWORD) =>
  cookieOf(await post("login", { email, password }));

const meStatus = async (cookie: string) =>
  (await fetch(`${base}/api/v1/auth/me`, { headers: { cookie } })).status;

const adminListStatus = async (cookie: string) =>
  (await fetch(`${base}/api/v1/admin/categories`, { headers: { cookie } })).status;

const seed = (email: string, password: string) =>
  promisify(execFile)(process.execPath, ["--import", "tsx", "src/scripts/seed-admin.ts"], {
    env: {
      ...process.env,
      ADMIN_USERNAME: "Owner",
      ADMIN_EMAIL: email,
      ADMIN_PASSWORD: password,
      LOG_LEVEL: "info",
    },
  });

// The script reports its reason in the log and exits with a failure code.
const assertSeedFails = (email: string, password: string, reason: RegExp) =>
  assert.rejects(seed(email, password), (err: { code?: number; stdout?: string }) => {
    assert.equal(err.code, 1);
    assert.match(err.stdout ?? "", reason);
    assert.ok(!(err.stdout ?? "").includes(password), "the log must not contain the password");
    return true;
  });

before(async () => {
  mongo = await MongoMemoryServer.create();
  // Set before the app loads, so tests can never touch the database in .env.
  process.env.MONGODB_URI = mongo.getUri("test");
  process.env.JWT_SECRET = "test-secret-".repeat(4);
  process.env.NODE_ENV = "test";
  process.env.LOG_LEVEL = "fatal";

  const { app } = await import("../src/app.js");
  const { connectDB } = await import("../src/config/db.js");
  ({ UserModel } = await import("../src/modules/users/user.model.js"));
  await connectDB();
  await UserModel.init();

  await new Promise<void>((resolve) => {
    server = app.listen(0, () => resolve());
  });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

after(async () => {
  server.close();
  await mongoose.disconnect();
  await mongo.stop();
});

test("the seed refuses an email a customer registered first", async () => {
  const attackerCookie = await register("owner@shop.example");

  await assertSeedFails("owner@shop.example", "owner-strong-password", /belongs to a customer/);

  const stored = await UserModel.findOne({ email: "owner@shop.example" }).lean();
  assert.equal(stored?.role, "customer");
  assert.equal(await adminListStatus(attackerCookie), 403);
  assert.equal(await adminListStatus(await login("owner@shop.example")), 403);
});

test("the seed refuses a short password and doesn't create the account", async () => {
  await assertSeedFails("short@shop.example", "elevenchars", /at least 12 characters/);
  assert.equal(await UserModel.countDocuments({ email: "short@shop.example" }), 0);
});

test("re-running the seed changes the password and ends old admin sessions", async () => {
  await seed("admin@shop.example", "first-admin-password");
  const oldCookie = await login("admin@shop.example", "first-admin-password");
  assert.equal(await adminListStatus(oldCookie), 200);

  await seed("admin@shop.example", "second-admin-password");

  assert.equal(await adminListStatus(oldCookie), 401, "stolen token stops working");
  const loginWithOld = await post("login", {
    email: "admin@shop.example",
    password: "first-admin-password",
  });
  assert.equal(loginWithOld.status, 401);
  assert.equal(
    await adminListStatus(await login("admin@shop.example", "second-admin-password")),
    200
  );
  assert.equal(await UserModel.countDocuments({ email: "admin@shop.example" }), 1);
});

test("logout cancels the token on every device", async () => {
  const email = "logout@shop.example";
  const firstDevice = await register(email);
  const secondDevice = await login(email);
  assert.equal(await meStatus(firstDevice), 200);
  assert.equal(await meStatus(secondDevice), 200);

  const res = await post("logout", {}, firstDevice);
  assert.equal(res.status, 200);
  assert.match(res.headers.getSetCookie()[0] ?? "", /^auth_token=;/);

  assert.equal(await meStatus(firstDevice), 401, "a copied token stops working");
  assert.equal(await meStatus(secondDevice), 401);
  assert.equal(await meStatus(await login(email)), 200, "logging in again works");
});

test("an old token can't log out a newer session", async () => {
  const email = "stale@shop.example";
  const stale = await register(email);
  await post("logout", {}, stale);
  const current = await login(email);

  await post("logout", {}, stale);
  assert.equal(await meStatus(current), 200);
});

test("logout still succeeds with no cookie or a bad one", async () => {
  assert.equal((await post("logout", {})).status, 200);
  assert.equal((await post("logout", {}, "auth_token=garbage")).status, 200);
  assert.equal((await post("logout", {}, 'auth_token=j:{"a":1}')).status, 200);
});

test("tokens without a version, like those issued before this change, are rejected", async () => {
  const email = "old-token@shop.example";
  await register(email);
  const user = await UserModel.findOne({ email }).orFail();
  const oldStyle = jwt.sign({}, process.env.JWT_SECRET ?? "", {
    subject: user.id,
    expiresIn: 60,
  });
  assert.equal(await meStatus(`auth_token=${oldStyle}`), 401);
});

test("accounts created before this change can still log in", async () => {
  const email = "existing@shop.example";
  await register(email);
  await UserModel.collection.updateOne({ email }, { $unset: { tokenVersion: "" } });

  const cookie = await login(email);
  assert.equal(await meStatus(cookie), 200);
  await post("logout", {}, cookie);
  assert.equal(await meStatus(cookie), 401);
});

test("the API trusts no proxy by default, so a fake IP header is ignored", async () => {
  const { app } = await import("../src/app.js");
  assert.equal(app.get("trust proxy"), 0);
});
