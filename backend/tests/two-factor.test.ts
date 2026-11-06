import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { PASSWORD, codeIn, startAuthApp, wrongCode } from "./auth-test-app.js";

let t: Awaited<ReturnType<typeof startAuthApp>>;
let count = 0;

const newUser = async () => {
  const client = new t.Client();
  const email = `twofa${++count}@shop.test`;
  await client.register(email);
  return { client, email };
};

const mailsTo = (email: string) => t.mails.filter((m) => m.to === email);
const latestCode = (email: string) =>
  codeIn(mailsTo(email).at(-1) ?? { to: "", subject: "", text: "" });

// The resend limit would otherwise make tests wait 60 seconds between codes.
const skipResendWait = (email: string) =>
  t.UserModel.updateOne({ email }, { twoFactorNextCodeAt: null });

const userWith2FA = async () => {
  const { client, email } = await newUser();
  await client.post("/auth/2fa/enable");
  await client.post("/auth/2fa/verify", { code: latestCode(email) });
  await skipResendWait(email);
  return { client, email };
};

const startLogin = async (email: string) => {
  await skipResendWait(email);
  const client = new t.Client();
  const res = await client.login(email);
  return { client, res, code: latestCode(email) };
};

before(async () => {
  t = await startAuthApp();
});
after(() => t.stop());

test("turning 2FA on takes a login and the emailed code", async () => {
  assert.equal((await new t.Client().post("/auth/2fa/enable")).status, 401);
  assert.equal((await new t.Client().post("/auth/2fa/verify", { code: "123456" })).status, 401);

  const { client, email } = await newUser();
  const enabling = await client.post("/auth/2fa/enable");
  assert.equal(enabling.status, 200);
  const code = latestCode(email);
  assert.match(code, /^\d{6}$/);
  assert.ok(!enabling.raw.includes(code), "the code is only in the email");

  const before2FA = await t.UserModel.findOne({ email }).lean();
  assert.equal(before2FA?.twoFactorEnabled, false, "not on until verified");
  assert.equal((await client.post("/auth/2fa/verify", { code: wrongCode(code) })).status, 400);

  const verified = await client.post("/auth/2fa/verify", { code });
  assert.equal(verified.status, 200);
  const after2FA = await t.UserModel.findOne({ email }).lean();
  assert.equal(after2FA?.twoFactorEnabled, true);
  assert.equal(after2FA?.emailVerified, true);

  assert.equal((await client.post("/auth/2fa/enable")).status, 409);
});

test("the stored code is a keyed hash, and is removed once used", async () => {
  const { client, email } = await newUser();
  await client.post("/auth/2fa/enable");
  const code = latestCode(email);

  const stored = await t.UserModel.findOne({ email }).select("+twoFactorCode").lean();
  assert.ok(stored?.twoFactorCode);
  assert.notEqual(stored?.twoFactorCode, code);
  assert.equal(stored?.twoFactorCode?.length, 64);

  await client.post("/auth/2fa/verify", { code });
  const used = await t.UserModel.findOne({ email }).select("+twoFactorCode").lean();
  assert.equal(used?.twoFactorCode, undefined);
});

test("login with 2FA on issues no session until the code is given", async () => {
  const { email } = await userWith2FA();
  const { client, res, code } = await startLogin(email);

  assert.equal(res.status, 200);
  assert.deepEqual(res.body.data, { requires2FA: true });
  assert.ok(!res.raw.includes("userId"), "no internal ID is exposed");
  assert.deepEqual([...client.jar.keys()], ["two_factor_pending"]);
  const cookie = res.setCookies[0] ?? "";
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /SameSite=Strict/);
  assert.match(cookie, /Path=\/api\/v1\/auth\/2fa/);

  assert.equal((await client.get("/auth/me")).status, 401);

  const done = await client.post("/auth/2fa/validate", { code });
  assert.equal(done.status, 200);
  assert.equal(done.body.data.user.email, email);
  assert.ok(client.jar.has("access_token"));
  assert.ok(client.jar.has("refresh_token"));
  assert.ok(!client.jar.has("two_factor_pending"));
  assert.equal((await client.get("/auth/me")).status, 200);
});

test("the wrong password never reaches the 2FA step", async () => {
  const { email } = await userWith2FA();
  const before = mailsTo(email).length;
  const client = new t.Client();
  assert.equal((await client.login(email, "wrong-password")).status, 401);
  assert.equal(client.jar.size, 0);
  assert.equal(mailsTo(email).length, before, "no code is sent");
});

test("validate needs the pending cookie, so a code alone can't log in", async () => {
  const { email } = await userWith2FA();
  const { code } = await startLogin(email);
  const res = await new t.Client().post("/auth/2fa/validate", { code });
  assert.equal(res.status, 400);
});

test("a pending cookie can't be used as an access token", async () => {
  const { email } = await userWith2FA();
  const { client } = await startLogin(email);
  client.jar.set("access_token", client.jar.get("two_factor_pending") ?? "");
  assert.equal((await client.get("/auth/me")).status, 401);
});

test("a code works once and expires", async () => {
  const { email } = await userWith2FA();
  const { client, code } = await startLogin(email);
  assert.equal((await client.post("/auth/2fa/validate", { code })).status, 200);

  const replay = await startLogin(email);
  const usedAgain = wrongCode(replay.code) === code ? wrongCode(code) : code;
  assert.equal((await replay.client.post("/auth/2fa/validate", { code: usedAgain })).status, 400);

  const late = await startLogin(email);
  await t.UserModel.updateOne({ email }, { twoFactorExpires: new Date(Date.now() - 1000) });
  assert.equal((await late.client.post("/auth/2fa/validate", { code: late.code })).status, 400);
});

test("five wrong codes cancel the code and hold back new ones", async () => {
  const { email } = await userWith2FA();
  const { client, code } = await startLogin(email);

  for (let i = 0; i < 5; i++) {
    const res = await client.post("/auth/2fa/validate", { code: wrongCode(code) });
    assert.equal(res.status, 400, `attempt ${i + 1}`);
  }
  assert.equal(
    (await client.post("/auth/2fa/validate", { code })).status,
    400,
    "the real code is dead"
  );

  const before = mailsTo(email).length;
  const retry = new t.Client();
  assert.equal((await retry.login(email)).status, 200);
  assert.equal(mailsTo(email).length, before, "no new code during the lock");
  const stored = await t.UserModel.findOne({ email }).select("+twoFactorNextCodeAt").lean();
  const minutes = ((stored?.twoFactorNextCodeAt?.getTime() ?? 0) - Date.now()) / 60_000;
  assert.ok(minutes > 14 && minutes <= 15);
});

test("parallel guesses can't get past the attempt limit", async () => {
  const { email } = await userWith2FA();
  const { client, code } = await startLogin(email);
  await Promise.all(
    Array.from({ length: 8 }, () => client.post("/auth/2fa/validate", { code: wrongCode(code) }))
  );
  assert.equal((await client.post("/auth/2fa/validate", { code })).status, 400);
});

test("logging in again within a minute sends no extra email", async () => {
  const { email } = await userWith2FA();
  const first = await startLogin(email);
  const before = mailsTo(email).length;

  const second = new t.Client();
  assert.equal((await second.login(email)).status, 200);
  assert.equal(mailsTo(email).length, before);
  assert.equal((await second.post("/auth/2fa/validate", { code: first.code })).status, 200);
});

test("if the email fails, login says so and can be retried at once", async () => {
  const { email } = await userWith2FA();
  await skipResendWait(email);
  t.sendMock.mock.mockImplementationOnce(async () => {
    throw new Error("SMTP down");
  });
  const client = new t.Client();
  const failed = await client.login(email);
  assert.equal(failed.status, 503);
  assert.equal(failed.body.error.code, "EMAIL_FAILED");
  assert.equal(client.jar.size, 0);

  const { res } = await startLogin(email);
  assert.equal(res.status, 200);
});

test("resetting the password cancels a pending login", async () => {
  const { email } = await userWith2FA();
  const { client, code } = await startLogin(email);
  await t.UserModel.updateOne({ email }, { $inc: { tokenVersion: 1 } });
  assert.equal((await client.post("/auth/2fa/validate", { code })).status, 400);
});

test("turning 2FA off takes a login and a fresh code", async () => {
  const { client, email } = await userWith2FA();
  assert.equal((await new t.Client().post("/auth/2fa/disable", { code: "123456" })).status, 401);

  assert.equal((await client.post("/auth/2fa/disable/request")).status, 200);
  const code = latestCode(email);
  assert.equal((await client.post("/auth/2fa/disable", { code: wrongCode(code) })).status, 400);
  assert.equal((await client.post("/auth/2fa/disable", { code })).status, 200);

  const stored = await t.UserModel.findOne({ email }).lean();
  assert.equal(stored?.twoFactorEnabled, false);
  assert.equal((await client.post("/auth/2fa/disable/request")).status, 409);

  const res = await new t.Client().login(email, PASSWORD);
  assert.ok(res.body.data.user, "normal login is back");
});

test("code input is validated", async () => {
  const { client } = await newUser();
  for (const code of ["12345", "1234567", "abcdef", { $ne: "" }, 123456, ""]) {
    assert.equal(
      (await client.post("/auth/2fa/verify", { code })).status,
      400,
      JSON.stringify(code)
    );
  }
  assert.equal(
    (await client.post("/auth/2fa/verify", { code: "123456" })).status,
    400,
    "no code sent"
  );
});
