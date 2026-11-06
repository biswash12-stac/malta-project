import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import jwt from "jsonwebtoken";
import { PASSWORD, startAuthApp } from "./auth-test-app.js";

let t: Awaited<ReturnType<typeof startAuthApp>>;
let count = 0;

const newUser = async () => {
  const client = new t.Client();
  const email = `user${++count}@shop.test`;
  await client.register(email);
  return { client, email };
};

before(async () => {
  t = await startAuthApp();
});
after(() => t.stop());

test("login sets both cookies safely and never puts tokens in the body", async () => {
  const { email } = await newUser();
  const client = new t.Client();
  const res = await client.login(email);
  assert.equal(res.status, 200);

  const access = res.setCookies.find((c) => c.startsWith("access_token=")) ?? "";
  const refresh = res.setCookies.find((c) => c.startsWith("refresh_token=")) ?? "";
  assert.match(access, /Max-Age=900;/);
  assert.match(access, /HttpOnly/);
  assert.match(access, /SameSite=Lax/);
  assert.match(access, /Path=\//);
  assert.match(refresh, /Max-Age=604800;/);
  assert.match(refresh, /HttpOnly/);
  assert.match(refresh, /SameSite=Strict/);
  assert.match(refresh, /Path=\/api\/v1\/auth/);

  for (const value of client.jar.values()) assert.ok(!res.raw.includes(value));
  assert.deepEqual(Object.keys(res.body.data), ["user"]);
  assert.equal((await client.get("/auth/me")).status, 200);
});

test("the refresh token is stored only as a hash", async () => {
  const { client } = await newUser();
  const token = client.jar.get("refresh_token") ?? "";
  assert.equal(await t.RefreshSessionModel.countDocuments({ tokenHash: token }), 0);
  assert.equal(token.length, 64);
});

test("an expired access token gets a 401, and refresh restores the session", async () => {
  const { client } = await newUser();
  const { sub, ver } = jwt.decode(client.jar.get("access_token") ?? "") as jwt.JwtPayload;
  client.jar.set(
    "access_token",
    jwt.sign({ use: "access", ver }, process.env.JWT_SECRET ?? "", {
      subject: sub ?? "",
      expiresIn: -5,
    })
  );
  assert.equal((await client.get("/auth/me")).status, 401);

  const refreshed = await client.post("/auth/refresh");
  assert.equal(refreshed.status, 200);
  assert.ok(refreshed.body.data.user.email);
  for (const value of client.jar.values()) assert.ok(!refreshed.raw.includes(value));
  assert.equal((await client.get("/auth/me")).status, 200);
});

test("refresh replaces the token; a parallel old one gets an access token only", async () => {
  const { client } = await newUser();
  const original = client.jar.get("refresh_token") ?? "";

  assert.equal((await client.post("/auth/refresh")).status, 200);
  assert.notEqual(client.jar.get("refresh_token"), original, "rotated");

  const otherTab = new t.Client();
  otherTab.jar.set("refresh_token", original);
  const res = await otherTab.post("/auth/refresh");
  assert.equal(res.status, 200, "within the grace period");
  assert.ok(otherTab.jar.get("access_token"));
  assert.equal(otherTab.jar.get("refresh_token"), original, "no second new refresh token");
});

test("parallel refreshes from two tabs all succeed and don't log anyone out", async () => {
  const { client } = await newUser();
  const results = await Promise.all([1, 2, 3].map(() => client.post("/auth/refresh")));
  assert.deepEqual(
    results.map((r) => r.status),
    [200, 200, 200]
  );
  assert.equal((await client.get("/auth/me")).status, 200);
});

test("reusing a replaced token after the grace period ends every session", async () => {
  const { client, email } = await newUser();
  const secondDevice = new t.Client();
  await secondDevice.login(email);
  const stolen = client.jar.get("refresh_token") ?? "";
  await client.post("/auth/refresh");

  await t.RefreshSessionModel.updateMany(
    { replacedAt: { $ne: null } },
    { replacedAt: new Date(Date.now() - 60_000) }
  );

  const thief = new t.Client();
  thief.jar.set("refresh_token", stolen);
  const res = await thief.post("/auth/refresh");
  assert.equal(res.status, 401);
  assert.equal(thief.jar.size, 0, "cookies are cleared");

  assert.equal((await client.get("/auth/me")).status, 401, "access token cancelled too");
  assert.equal((await client.post("/auth/refresh")).status, 401);
  assert.equal((await secondDevice.post("/auth/refresh")).status, 401);
  assert.equal((await new t.Client().login(email)).status, 200, "logging in again works");
});

test("refresh rejects a missing, unknown or expired token", async () => {
  const { client } = await newUser();

  assert.equal((await new t.Client().post("/auth/refresh")).status, 401);

  const unknown = new t.Client();
  unknown.jar.set("refresh_token", "a".repeat(64));
  assert.equal((await unknown.post("/auth/refresh")).status, 401);

  await t.RefreshSessionModel.updateMany(
    {},
    { expiresAt: new Date(Date.now() - 1000) },
    { strict: false }
  );
  assert.equal((await client.post("/auth/refresh")).status, 401);
});

test("logout works with an expired access token and cancels the refresh token", async () => {
  const { client } = await newUser();
  const access = client.jar.get("access_token") ?? "";
  const refresh = client.jar.get("refresh_token") ?? "";

  client.jar.delete("access_token");
  const res = await client.post("/auth/logout");
  assert.equal(res.status, 200);
  assert.equal(client.jar.size, 0);

  const copy = new t.Client();
  copy.jar.set("refresh_token", refresh);
  assert.equal((await copy.post("/auth/refresh")).status, 401);
  const accessCopy = new t.Client();
  accessCopy.jar.set("access_token", access);
  assert.equal((await accessCopy.get("/auth/me")).status, 401);
});

test("a token made for another job isn't accepted as an access token", async () => {
  const { client, email } = await newUser();
  const user = await t.UserModel.findOne({ email }).orFail();
  const pending = jwt.sign(
    { use: "pending-2fa", ver: user.tokenVersion },
    process.env.JWT_SECRET ?? "",
    {
      subject: user.id,
      expiresIn: 60,
    }
  );
  client.jar.set("access_token", pending);
  assert.equal((await client.get("/auth/me")).status, 401);

  client.jar.set("access_token", client.jar.get("refresh_token") ?? "");
  assert.equal((await client.get("/auth/me")).status, 401);
});

test("normal email and password login is unchanged for existing accounts", async () => {
  const { email } = await newUser();
  await t.UserModel.collection.updateOne(
    { email },
    { $unset: { tokenVersion: "", emailVerified: "", twoFactorEnabled: "" } }
  );

  const client = new t.Client();
  assert.equal((await client.login(email, "wrong-password")).status, 401);
  assert.equal(client.jar.size, 0);

  const ok = await client.login(email, PASSWORD);
  assert.equal(ok.status, 200);
  assert.equal(ok.body.data.user.email, email);
  assert.equal(ok.body.data.requires2FA, undefined);
  assert.equal((await client.get("/auth/me")).status, 200);
  assert.equal((await client.post("/auth/refresh")).status, 200);
});
