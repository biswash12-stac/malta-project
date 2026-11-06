import assert from "node:assert/strict";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { after, before, test } from "node:test";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";

let mongo: MongoMemoryServer;
let server: Server;
let base: string;

const PASSWORD = "correct-horse-battery";

const post = (path: string, body: unknown) =>
  fetch(`${base}/api/v1/auth/${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

const register = (email: string, password = PASSWORD) =>
  post("register", { username: "Test", email, password });

const loginStatus = async (email: string, password: string) =>
  (await post("login", { email, password })).status;

before(async () => {
  mongo = await MongoMemoryServer.create();
  // Set before the app loads, so tests can never touch the database in .env.
  process.env.MONGODB_URI = mongo.getUri("test");
  process.env.JWT_SECRET = "test-secret-".repeat(4);
  process.env.NODE_ENV = "test";
  process.env.LOG_LEVEL = "fatal";

  const { app } = await import("../src/app.js");
  const { connectDB } = await import("../src/config/db.js");
  const { UserModel } = await import("../src/modules/users/user.model.js");
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

test("the password schema blocks common passwords and allows others", async () => {
  const { registerSchema } = await import("../src/modules/auth/auth.schema.js");
  const accepts = (password: string) =>
    registerSchema.safeParse({ username: "Test", email: "a@b.co", password }).success;

  for (const weak of [
    "12345678",
    "password",
    "PASSWORD",
    "Pass1234",
    "aaaaaaaa",
    "🙂🙂🙂🙂🙂🙂🙂🙂",
  ]) {
    assert.equal(accepts(weak), false, weak);
  }
  for (const fine of [PASSWORD, "password-123", "aaaaaaab"]) {
    assert.equal(accepts(fine), true, fine);
  }
});

test("registering with a common password returns a 400 naming the field", async () => {
  const res = await register("weak@shop.example", "pass1234");
  assert.equal(res.status, 400);
  assert.deepEqual((await res.json()).error.details.password, ["This password is too common"]);
});

test("HTML form posts are not read, so another site can't submit a login", async () => {
  const email = "form@shop.example";
  assert.equal((await register(email)).status, 201);

  const res = await fetch(`${base}/api/v1/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ email, password: PASSWORD }).toString(),
  });
  assert.equal(res.status, 400);
  assert.equal(res.headers.getSetCookie().length, 0, "no login cookie is set");
});

test("failed logins lock that account only, and successes don't count", async () => {
  const email = "target@shop.example";
  const other = "other@shop.example";
  assert.equal((await register(email)).status, 201);
  assert.equal((await register(other)).status, 201);

  assert.equal(await loginStatus(email, PASSWORD), 200);
  assert.equal(await loginStatus(email, PASSWORD), 200);

  for (let i = 0; i < 10; i++) {
    assert.equal(await loginStatus(email, "wrong-password"), 401, `attempt ${i + 1}`);
  }

  assert.equal(await loginStatus(email, "wrong-password"), 429);
  assert.equal(await loginStatus(email.toUpperCase(), PASSWORD), 429, "email case doesn't help");
  assert.equal(await loginStatus(other, PASSWORD), 200, "other accounts still work");
});

// Keep last: it uses up the general limit for the rest of this process.
test("one IP is limited across the whole API, but health checks keep working", async () => {
  const statuses: number[] = [];
  for (let i = 0; i < 320; i++) {
    const res = await fetch(`${base}/api/v1/no-such-route`);
    await res.arrayBuffer();
    statuses.push(res.status);
  }
  assert.ok(statuses.includes(429));

  const limited = await fetch(`${base}/api/v1/no-such-route`, {
    headers: { origin: "http://localhost:3000" },
  });
  assert.equal(limited.status, 429);
  assert.equal((await limited.json()).error.code, "RATE_LIMITED");
  assert.equal(limited.headers.get("access-control-allow-origin"), "http://localhost:3000");

  assert.equal((await fetch(`${base}/api/v1/health`)).status, 200);
});
