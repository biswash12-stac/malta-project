import assert from "node:assert/strict";
import { after, before, beforeEach, mock, test } from "node:test";
import { PASSWORD, codeIn, startAuthApp } from "./auth-test-app.js";

let t: Awaited<ReturnType<typeof startAuthApp>>;
let verifyMock: { mock: { calls: { arguments: unknown[] }[]; resetCalls: () => void } };
let googleClient: typeof import("../src/modules/auth/google.service.js").googleClient;
let count = 0;

type GooglePayload = { sub?: string; email?: string; email_verified?: boolean; name?: string };

// What Google would say about the credential. The real signature check is Google's library.
let payload: GooglePayload | null = null;

const signIn = (client = new t.Client()) =>
  client
    .post("/auth/google", { credential: "a-google-credential" })
    .then((res) => ({ res, client }));

const asGoogle = (email: string, sub = `google-${++count}`) => {
  payload = { sub, email, email_verified: true, name: "Google User" };
  return sub;
};

before(async () => {
  t = await startAuthApp();
  ({ googleClient } = await import("../src/modules/auth/google.service.js"));
  verifyMock = mock.method(googleClient, "verifyIdToken", async () => {
    if (!payload) throw new Error("Invalid token");
    return { getPayload: () => payload };
  }) as never;
});
beforeEach(() => {
  payload = null;
  verifyMock.mock.resetCalls();
});
after(() => t.stop());

test("a new email creates a customer with no password and normal cookies", async () => {
  const email = `new${++count}@shop.test`;
  asGoogle(email);
  const { res, client } = await signIn();

  assert.equal(res.status, 200);
  assert.deepEqual(
    { ...res.body.data.user, id: "" },
    { id: "", username: "Google User", email, role: "customer", twoFactorEnabled: false }
  );
  assert.ok(client.jar.has("access_token"));
  assert.ok(client.jar.has("refresh_token"));
  for (const value of client.jar.values()) assert.ok(!res.raw.includes(value));
  assert.equal((await client.get("/auth/me")).status, 200);
  assert.equal((await client.post("/auth/refresh")).status, 200);

  const stored = await t.UserModel.findOne({ email }).select("+passwordHash").lean();
  assert.equal(stored?.passwordHash, undefined);
  assert.equal(stored?.emailVerified, true);
});

test("the credential is checked against our client ID", async () => {
  asGoogle(`aud${++count}@shop.test`);
  await signIn();
  assert.deepEqual(verifyMock.mock.calls[0]?.arguments[0], {
    idToken: "a-google-credential",
    audience: "test-client-id",
  });
});

test("signing in twice uses the same account, even if the Google email changes", async () => {
  const email = `same${++count}@shop.test`;
  const sub = asGoogle(email);
  const first = await signIn();
  const second = await signIn();
  assert.equal(first.res.body.data.user.id, second.res.body.data.user.id);

  payload = { sub, email: `changed${count}@shop.test`, email_verified: true };
  const third = await signIn();
  assert.equal(third.res.body.data.user.id, first.res.body.data.user.id);
  assert.equal(await t.UserModel.countDocuments({ email }), 1);
});

test("a Google-only account can't log in with a password", async () => {
  const email = `only${++count}@shop.test`;
  asGoogle(email);
  await signIn();
  const res = await new t.Client().login(email, PASSWORD);
  assert.equal(res.status, 401);
  assert.equal(res.body.error.message, "Invalid email or password");
});

test("account takeover is blocked: an unverified account loses its password and sessions", async () => {
  const email = `victim${++count}@shop.test`;
  const attacker = new t.Client();
  assert.equal((await attacker.register(email)).status, 201);
  assert.equal((await attacker.get("/auth/me")).status, 200);

  asGoogle(email);
  const { res, client: victim } = await signIn();
  assert.equal(res.status, 200);

  assert.equal((await attacker.get("/auth/me")).status, 401, "attacker's access token");
  assert.equal((await attacker.post("/auth/refresh")).status, 401, "attacker's refresh token");
  assert.equal((await new t.Client().login(email, PASSWORD)).status, 401, "attacker's password");
  assert.equal((await victim.get("/auth/me")).status, 200, "the real owner is logged in");
  assert.equal(await t.UserModel.countDocuments({ email }), 1);
});

test("a verified account keeps its password when linked", async () => {
  const email = `verified${++count}@shop.test`;
  const owner = new t.Client();
  await owner.register(email);
  await t.UserModel.updateOne({ email }, { emailVerified: true });

  asGoogle(email);
  const { res } = await signIn();
  assert.equal(res.status, 200);
  assert.equal((await owner.get("/auth/me")).status, 200, "existing session survives");
  assert.equal((await new t.Client().login(email, PASSWORD)).status, 200);
});

test("a seeded admin keeps their password and role", async () => {
  const email = `admin${++count}@shop.test`;
  await new t.Client().register(email);
  await t.UserModel.updateOne({ email }, { role: "admin" });

  asGoogle(email);
  const { res } = await signIn();
  assert.equal(res.body.data.user.role, "admin");
  assert.equal((await new t.Client().login(email, PASSWORD)).status, 200);
});

test("2FA is required for Google login too", async () => {
  const email = `twofa${++count}@shop.test`;
  const owner = new t.Client();
  await owner.register(email);
  await owner.post("/auth/2fa/enable");
  const enable = t.mails.filter((m) => m.to === email).at(-1);
  await owner.post("/auth/2fa/verify", {
    code: codeIn(enable ?? { to: "", subject: "", text: "" }),
  });
  await t.UserModel.updateOne({ email }, { twoFactorNextCodeAt: null });

  asGoogle(email);
  const { res, client } = await signIn();
  assert.deepEqual(res.body.data, { requires2FA: true });
  assert.deepEqual([...client.jar.keys()], ["two_factor_pending"]);

  const code = codeIn(
    t.mails.filter((m) => m.to === email).at(-1) ?? { to: "", subject: "", text: "" }
  );
  assert.equal((await client.post("/auth/2fa/validate", { code })).status, 200);
  assert.equal((await client.get("/auth/me")).status, 200);
});

test("bad credentials, unverified Google emails and conflicts are rejected", async () => {
  const { res: invalid, client } = await signIn();
  assert.equal(invalid.status, 401);
  assert.equal(client.jar.size, 0);

  const unverifiedEmail = `unverified${++count}@shop.test`;
  payload = { sub: "x1", email: unverifiedEmail, email_verified: false };
  assert.equal((await signIn()).res.status, 401);
  assert.equal(await t.UserModel.countDocuments({ email: unverifiedEmail }), 0);

  payload = { sub: "x2", email_verified: true };
  assert.equal((await signIn()).res.status, 401);

  const taken = `taken${++count}@shop.test`;
  asGoogle(taken, "first-google-id");
  await signIn();
  asGoogle(taken, "second-google-id");
  assert.equal((await signIn()).res.status, 401, "email tied to another Google account");
});

test("the credential must be a string", async () => {
  for (const credential of ["", { $ne: "" }, 5, "x".repeat(5001)]) {
    const res = await new t.Client().post("/auth/google", { credential });
    assert.equal(res.status, 400, JSON.stringify(credential).slice(0, 20));
  }
  assert.equal((await new t.Client().post("/auth/google", {})).status, 400);
});
