import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { after, before, test } from "node:test";
import { PASSWORD, startAuthApp, type Mail } from "./auth-test-app.js";

let t: Awaited<ReturnType<typeof startAuthApp>>;
let count = 0;

const NEW_PASSWORD = "a-brand-new-password";

const newUser = async () => {
  const client = new t.Client();
  const email = `reset${++count}@shop.test`;
  await client.register(email);
  return { client, email };
};

const tokenIn = (mail: Mail) => /token=([0-9a-f]{64})/.exec(mail.text)?.[1] ?? "";

const requestToken = async (email: string) => {
  const res = await new t.Client().post("/auth/forgot-password", { email });
  assert.equal(res.status, 200);
  return tokenIn(await t.waitForMail(email));
};

const reset = (token: string, password = NEW_PASSWORD) =>
  new t.Client().post("/auth/reset-password", { token, password });

before(async () => {
  t = await startAuthApp();
});
after(() => t.stop());

test("known and unknown emails get an identical response", async () => {
  const { email } = await newUser();
  const known = await new t.Client().post("/auth/forgot-password", { email });
  const unknown = await new t.Client().post("/auth/forgot-password", {
    email: "nobody@shop.test",
  });
  assert.equal(known.status, 200);
  assert.equal(unknown.status, 200);
  assert.deepEqual(known.body, unknown.body);

  await t.waitForMail(email);
  await new Promise((resolve) => setTimeout(resolve, 50));
  assert.equal(t.mails.filter((m) => m.to === "nobody@shop.test").length, 0);
});

test("a failed email doesn't change the response", async () => {
  const { email } = await newUser();
  t.sendMock.mock.mockImplementationOnce(async () => {
    throw new Error("SMTP down");
  });
  const res = await new t.Client().post("/auth/forgot-password", { email });
  assert.equal(res.status, 200);
});

test("the email links to the frontend, and only a hash is stored", async () => {
  const { email } = await newUser();
  const token = await requestToken(email);
  assert.ok(
    (await t.waitForMail(email)).text.includes(`http://shop.test/reset-password?token=${token}`)
  );

  const user = await t.UserModel.findOne({ email })
    .select("+passwordResetToken +passwordResetExpires")
    .orFail();
  assert.notEqual(user.passwordResetToken, token);
  assert.equal(user.passwordResetToken, createHash("sha256").update(token).digest("hex"));
  const minutes = ((user.passwordResetExpires?.getTime() ?? 0) - Date.now()) / 60_000;
  assert.ok(minutes > 29 && minutes <= 30);
});

test("reset changes the password, ends all sessions and works once", async () => {
  const { client, email } = await newUser();
  const token = await requestToken(email);

  assert.equal((await reset(token)).status, 200);

  assert.equal((await new t.Client().login(email, PASSWORD)).status, 401, "old password");
  assert.equal((await new t.Client().login(email, NEW_PASSWORD)).status, 200, "new password");
  assert.equal((await client.get("/auth/me")).status, 401, "old access token");
  assert.equal((await client.post("/auth/refresh")).status, 401, "old refresh token");

  const again = await reset(token, "yet-another-password");
  assert.equal(again.status, 400);
  assert.ok(again.body.error.details.token);
  assert.equal((await new t.Client().login(email, NEW_PASSWORD)).status, 200);

  const stored = await t.UserModel.findOne({ email })
    .select("+passwordResetToken +passwordResetExpires")
    .lean();
  assert.equal(stored?.passwordResetToken, undefined);
  assert.equal(stored?.passwordResetExpires, undefined);
});

test("parallel resets with one token can only succeed once", async () => {
  const { email } = await newUser();
  const token = await requestToken(email);
  const results = await Promise.all([reset(token), reset(token, "a-different-password")]);
  assert.deepEqual(results.map((r) => r.status).sort(), [200, 400]);
});

test("an expired token is rejected and the password stays", async () => {
  const { email } = await newUser();
  const token = await requestToken(email);
  await t.UserModel.updateOne({ email }, { passwordResetExpires: new Date(Date.now() - 1000) });

  assert.equal((await reset(token)).status, 400);
  assert.equal((await new t.Client().login(email, PASSWORD)).status, 200);
});

test("bad input is rejected, including weak passwords and old-style URLs", async () => {
  const { email } = await newUser();
  const token = await requestToken(email);

  const weak = await reset(token, "pass1234");
  assert.equal(weak.status, 400);
  assert.ok(weak.body.error.details.password);

  for (const bad of ["abc", "x".repeat(64), { $ne: "" }, "A".repeat(64)]) {
    const res = await new t.Client().post("/auth/reset-password", {
      token: bad,
      password: NEW_PASSWORD,
    });
    assert.equal(res.status, 400, JSON.stringify(bad));
  }
  assert.equal(
    (await new t.Client().post("/auth/forgot-password", { email: { $gt: "" } })).status,
    400
  );
  assert.equal(
    (await new t.Client().post(`/auth/reset-password/${token}`, { password: NEW_PASSWORD })).status,
    404
  );
  assert.equal((await new t.Client().login(email, PASSWORD)).status, 200, "token wasn't spent");
});

test("forgot password is limited per email, even across IP addresses", async () => {
  const { email } = await newUser();
  const statuses: number[] = [];
  for (let i = 0; i < 7; i++) {
    statuses.push((await new t.Client().post("/auth/forgot-password", { email })).status);
  }
  assert.deepEqual(statuses, [200, 200, 200, 200, 200, 429, 429]);
});

test("forgot password is limited per IP, even across emails", async () => {
  const client = new t.Client();
  const statuses: number[] = [];
  for (let i = 0; i < 7; i++) {
    const res = await client.post("/auth/forgot-password", { email: `ip${i}@shop.test` });
    statuses.push(res.status);
  }
  assert.deepEqual(statuses, [200, 200, 200, 200, 200, 429, 429]);
});
