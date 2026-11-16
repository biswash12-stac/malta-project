import assert from "node:assert/strict";
import { after, before, test, type TestContext } from "node:test";
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

const MIN = 60_000;

// How long until a new code may be sent: about 1 minute for the resend wait, 15 for a lock.
const minutesUntilNextCode = async (email: string) => {
  const stored = await t.UserModel.findOne({ email }).select("+twoFactorNextCodeAt").lean();
  return ((stored?.twoFactorNextCodeAt?.getTime() ?? 0) - Date.now()) / MIN;
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
  const minutes = await minutesUntilNextCode(email);
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

// A-01: at most five guesses per account in a fixed 15-minute window. The window opens at the first
// counted guess; only its end or a correct code starts the count again. A new code changes neither.
const guessWrong = async (
  client: InstanceType<typeof t.Client>,
  code: string,
  times: number,
  path = "/auth/2fa/validate"
) => {
  for (let i = 0; i < times; i++) {
    assert.equal((await client.post(path, { code: wrongCode(code) })).status, 400);
  }
};

const storedCount = async (email: string) => {
  const stored = await t.UserModel.findOne({ email })
    .select("+twoFactorAttempts +twoFactorWindowStart")
    .lean();
  return {
    attempts: stored?.twoFactorAttempts,
    windowStart: stored?.twoFactorWindowStart,
  };
};

// A login that keeps any lock in place (startLogin clears the resend wait, which would end a lock).
// It asserts nothing, so it's safe inside a pause handler: an assertion failing there would run
// inside the server's request and come back as a 500 instead of a clear test failure.
const tryLogin = async (email: string) => {
  const client = new t.Client();
  const mailsBefore = mailsTo(email).length;
  const res = await client.login(email);
  const sent = mailsTo(email).length > mailsBefore;
  return { client, status: res.status, sent, code: latestCode(email) };
};

const plainLogin = async (email: string) => {
  const login = await tryLogin(email);
  assert.equal(login.status, 200);
  return login;
};

type Ctx = Pick<TestContext, "mock" | "signal">;

// Moves the clock the server sees (only Date is faked), so windows and locks run their real course.
// The test's own timers, so node:test puts the real clock back even if the test times out.
// A test that has already timed out (during its setup) gets no fake clock, for the same reason as
// pauseCounts below: nothing would turn it off again.
const withClock = async (ctx: Ctx, fn: (tick: (ms: number) => void) => Promise<void>) => {
  if (ctx.signal.aborted) throw new Error("The test has already timed out, so no fake clock");
  ctx.mock.timers.enable({ apis: ["Date"], now: Date.now() });
  try {
    await fn((ms) => ctx.mock.timers.tick(ms));
  } finally {
    ctx.mock.timers.reset();
  }
};

// Runs handlers[i] right after the i-th guess is counted, before that guess carries on.
// Only the guess count matches: a findOneAndUpdate whose update is a pipeline (an array) and
// whose filter names the stored code (twoFactorCode), so no other write can use up a handler.
// The hook goes on the test's own mock tracker, which node:test removes when the test ends,
// even when it times out. A test that has already timed out (during its setup) gets no hook:
// its tracker has already been reset, so nothing would remove a hook added now.
const pauseCounts = (ctx: Ctx, ...handlers: (() => Promise<void>)[]) => {
  if (ctx.signal.aborted) throw new Error("The test has already timed out, so no pause hook");
  const real = t.UserModel.findOneAndUpdate.bind(t.UserModel);
  let counted = 0;
  return ctx.mock.method(t.UserModel, "findOneAndUpdate", ((
    filter: object,
    update: unknown,
    ...rest: unknown[]
  ) => {
    const query = (real as (...args: unknown[]) => ReturnType<typeof real>)(
      filter,
      update,
      ...rest
    );
    if (!Array.isArray(update) || !filter || !("twoFactorCode" in filter)) return query;
    const exec = query.exec.bind(query);
    query.exec = (async () => {
      const result = await exec();
      // Only a guess that was really counted (the update matched a document) takes a handler.
      if (result !== null) {
        const during = handlers[counted++];
        if (during) await during();
      }
      return result;
    }) as never;
    return query;
  }) as never);
};

test("A-01: five wrong guesses lock, and asking for a new code can't get round it", async () => {
  const { email } = await userWith2FA();
  const first = await startLogin(email);
  await guessWrong(first.client, first.code, 4);

  const mailsBefore = mailsTo(email).length;
  // No time passes: startLogin only clears the resend wait, so logging in again sends a new code at
  // once, while the window and the count stay as they are.
  const second = await startLogin(email);
  assert.equal(mailsTo(email).length, mailsBefore + 1, "a new code was sent");
  await guessWrong(second.client, second.code, 1);

  const res = await second.client.post("/auth/2fa/validate", { code: second.code });
  assert.equal(res.status, 400, "five wrong guesses in all: even the right code is refused");
  const minutes = await minutesUntilNextCode(email);
  assert.ok(minutes > 14 && minutes <= 15, "and new codes are held back for 15 minutes");
  assert.equal((await plainLogin(email)).sent, false, "logging in again sends nothing");
});

test("A-01: the window is fixed: an expired code doesn't give back the guesses", async (ctx) => {
  const { email } = await userWith2FA();
  await withClock(ctx, async (tick) => {
    const first = await startLogin(email);
    await guessWrong(first.client, first.code, 4);
    tick(11 * MIN); // the code has expired, but the 15-minute window hasn't

    const mailsBefore = mailsTo(email).length;
    const second = await startLogin(email);
    assert.equal(mailsTo(email).length, mailsBefore + 1, "a new code was sent");
    await guessWrong(second.client, second.code, 1);
    const res = await second.client.post("/auth/2fa/validate", { code: second.code });
    assert.equal(res.status, 400, "still five guesses in this window");
  });
});

test("A-01: once the 15-minute window has passed, all five tries come back", async (ctx) => {
  const { email } = await userWith2FA();
  await withClock(ctx, async (tick) => {
    const first = await startLogin(email);
    await guessWrong(first.client, first.code, 4);
    tick(16 * MIN);

    const second = await startLogin(email);
    await guessWrong(second.client, second.code, 4);
    const res = await second.client.post("/auth/2fa/validate", { code: second.code });
    assert.equal(res.status, 200);
  });
});

test("A-01: when the 15-minute lock ends, a new code works again", async (ctx) => {
  const { email } = await userWith2FA();
  await withClock(ctx, async (tick) => {
    const first = await startLogin(email);
    await guessWrong(first.client, first.code, 5);
    assert.equal((await plainLogin(email)).sent, false, "locked: no code");

    tick(15 * MIN + 1000);
    const after = await plainLogin(email);
    assert.equal(after.sent, true, "the lock has ended");
    const res = await after.client.post("/auth/2fa/validate", { code: after.code });
    assert.equal(res.status, 200, "the account is not locked out for good");
  });
});

test("A-01: a correct code starts the count again for the next login", async () => {
  const { email } = await userWith2FA();
  const first = await startLogin(email);
  await guessWrong(first.client, first.code, 4);
  assert.equal((await first.client.post("/auth/2fa/validate", { code: first.code })).status, 200);
  assert.deepEqual(await storedCount(email), { attempts: undefined, windowStart: undefined });

  const second = await startLogin(email);
  await guessWrong(second.client, second.code, 4);
  assert.equal((await second.client.post("/auth/2fa/validate", { code: second.code })).status, 200);
});

test("A-01: turning 2FA on shares the same limit", async () => {
  const { client, email } = await newUser();
  await client.post("/auth/2fa/enable");
  await guessWrong(client, latestCode(email), 4, "/auth/2fa/verify");

  await skipResendWait(email);
  const mailsBefore = mailsTo(email).length;
  assert.equal((await client.post("/auth/2fa/enable")).status, 200);
  assert.equal(mailsTo(email).length, mailsBefore + 1, "a new code was sent");
  const code = latestCode(email);
  await guessWrong(client, code, 1, "/auth/2fa/verify");

  assert.equal((await client.post("/auth/2fa/verify", { code })).status, 400);
  const stored = await t.UserModel.findOne({ email }).lean();
  assert.equal(stored?.twoFactorEnabled, false, "2FA stays off");
});

test("A-01: turning 2FA off shares the same limit", async () => {
  const { client, email } = await userWith2FA();
  assert.equal((await client.post("/auth/2fa/disable/request")).status, 200);
  await guessWrong(client, latestCode(email), 4, "/auth/2fa/disable");

  await skipResendWait(email);
  const mailsBefore = mailsTo(email).length;
  assert.equal((await client.post("/auth/2fa/disable/request")).status, 200);
  assert.equal(mailsTo(email).length, mailsBefore + 1, "a new code was sent");
  const code = latestCode(email);
  await guessWrong(client, code, 1, "/auth/2fa/disable");

  assert.equal((await client.post("/auth/2fa/disable", { code })).status, 400);
  const stored = await t.UserModel.findOne({ email }).lean();
  assert.equal(stored?.twoFactorEnabled, true, "2FA stays on");
});

test("A-01: the stored count is a number, and a new code moves neither it nor the window", async (ctx) => {
  const { email } = await userWith2FA();
  await withClock(ctx, async (tick) => {
    const first = await startLogin(email);
    const windowOpened = new Date();
    await guessWrong(first.client, first.code, 3);
    assert.deepEqual(await storedCount(email), { attempts: 3, windowStart: windowOpened });

    tick(2 * MIN);
    const mailsBefore = mailsTo(email).length;
    await startLogin(email);
    assert.equal(mailsTo(email).length, mailsBefore + 1, "a new code was sent");
    assert.deepEqual(await storedCount(email), { attempts: 3, windowStart: windowOpened });
  });
});

test("A-01: an interrupted lock (five counted, no lock written) acts as a lock and then ends", async (ctx) => {
  const { email } = await userWith2FA();
  await withClock(ctx, async (tick) => {
    const first = await startLogin(email);
    // As if the server stopped between counting the fifth wrong guess and writing the lock.
    await t.UserModel.updateOne(
      { email },
      { twoFactorAttempts: 5, twoFactorWindowStart: new Date(), twoFactorNextCodeAt: null }
    );

    assert.equal((await plainLogin(email)).sent, false, "no code that could never be used");
    const res = await first.client.post("/auth/2fa/validate", { code: first.code });
    assert.equal(res.status, 400);

    tick(15 * MIN + 1000);
    const after = await plainLogin(email);
    assert.equal(after.sent, true, "the window has ended");
    const ok = await after.client.post("/auth/2fa/validate", { code: after.code });
    assert.equal(ok.status, 200);
  });
});

// Has a timeout: it holds a guess open on purpose, so a regression must fail it, not hang it.
test(
  "A-01: a new login while the fifth, correct guess is checked sends no code and the guess works",
  { timeout: 30_000 },
  async (ctx) => {
    const { email } = await userWith2FA();
    const first = await startLogin(email);
    await guessWrong(first.client, first.code, 4);

    let during: Awaited<ReturnType<typeof tryLogin>> | undefined;
    const hook = pauseCounts(ctx, async () => {
      await skipResendWait(email);
      during = await tryLogin(email);
    });
    let res: { status: number };
    try {
      res = await first.client.post("/auth/2fa/validate", { code: first.code });
    } finally {
      hook.mock.restore();
    }
    assert.equal(during?.status, 200, "the login during the check went through");
    assert.equal(during?.sent, false, "no new code while five guesses are counted");
    assert.equal(res.status, 200, "the right code still logs in");
  }
);

// Has a timeout: it holds a guess open on purpose, so a regression must fail it, not hang it.
test(
  "A-01: a new login while the fifth, wrong guess is checked sends no code and the lock holds",
  { timeout: 30_000 },
  async (ctx) => {
    const { email } = await userWith2FA();
    const first = await startLogin(email);
    await guessWrong(first.client, first.code, 4);

    let during: Awaited<ReturnType<typeof tryLogin>> | undefined;
    const hook = pauseCounts(ctx, async () => {
      await skipResendWait(email);
      during = await tryLogin(email);
    });
    try {
      await guessWrong(first.client, first.code, 1);
    } finally {
      hook.mock.restore();
    }
    assert.equal(during?.status, 200, "the login during the check went through");
    assert.equal(during?.sent, false, "no code that the lock would cancel straight away");
    const minutes = await minutesUntilNextCode(email);
    assert.ok(minutes > 14 && minutes <= 15, "locked for 15 minutes");
  }
);

test("A-01: parallel wrong guesses before and after a new code still add up to the limit", async () => {
  const { email } = await userWith2FA();
  const first = await startLogin(email);
  const wrongBurst = (client: InstanceType<typeof t.Client>, code: string) =>
    Promise.all(
      Array.from({ length: 4 }, () => client.post("/auth/2fa/validate", { code: wrongCode(code) }))
    );
  await wrongBurst(first.client, first.code);
  assert.equal((await storedCount(email)).attempts, 4, "no parallel guess was lost");

  const mailsBefore = mailsTo(email).length;
  const second = await startLogin(email);
  assert.equal(mailsTo(email).length, mailsBefore + 1, "a new code was sent");
  await wrongBurst(second.client, second.code);
  const res = await second.client.post("/auth/2fa/validate", { code: second.code });
  assert.equal(res.status, 400);
});

// Has a timeout: it holds a guess open on purpose, so a regression must fail it, not hang it.
test(
  "A-01: a guess that reaches five just as the window ends can't cancel a code sent after it",
  { timeout: 30_000 },
  async (ctx) => {
    const { email } = await userWith2FA();
    await withClock(ctx, async (tick) => {
      const first = await startLogin(email);
      await guessWrong(first.client, first.code, 1); // the window opens at T
      tick(14 * MIN);
      const second = await startLogin(email); // a fresh code, still in the same window
      await guessWrong(second.client, second.code, 3); // four counted
      tick(MIN - 1); // 1 ms before the window ends

      let countWhenPaused: number | undefined;
      let late: Awaited<ReturnType<typeof tryLogin>> | undefined;
      const hook = pauseCounts(ctx, async () => {
        countWhenPaused = (await storedCount(email)).attempts;
        tick(1); // the window ends while the fifth guess is still being handled
        await skipResendWait(email); // so only the window decides whether a code may be sent
        late = await tryLogin(email);
      });
      try {
        await guessWrong(second.client, second.code, 1);
      } finally {
        hook.mock.restore();
      }

      assert.equal(countWhenPaused, 5, "the paused guess was the fifth in the old window");
      assert.equal(late?.status, 200, "the login during the check went through");
      assert.equal(late?.sent, true, "a new code was sent once the window ended");
      const res = await late?.client.post("/auth/2fa/validate", { code: late.code });
      assert.equal(res?.status, 200, "the older guess's lock didn't cancel the new code");
    });
  }
);

// Has a timeout: it holds requests open on purpose, so a regression must fail it, not hang it.
test(
  "A-01: a wrong guess racing the owner's correct one doesn't lock the owner afterwards",
  {
    timeout: 30_000,
  },
  async (ctx) => {
    const { email } = await userWith2FA();
    const owner = await startLogin(email);
    // Within the resend wait: the same code, but its own login.
    const attacker = await plainLogin(email);
    assert.equal(attacker.sent, false);
    await guessWrong(attacker.client, owner.code, 3);

    let releaseWrong = () => {};
    const wrongHeld = new Promise<void>((resolve) => (releaseWrong = resolve));
    // node:test aborts ctx.signal whenever the test ends, but a timed-out test body keeps running,
    // so on abort let both held requests go: the attacker's guess (wrongHeld) and the owner's check
    // (the aborted branch of its race below). After a normal end both are already released, so this
    // does nothing. An abort that already happened (a timeout during the setup above) fires no
    // event, so check for that too.
    const aborted = new Promise<void>((resolve) => {
      const letGo = () => {
        releaseWrong();
        resolve();
      };
      if (ctx.signal.aborted) letGo();
      else ctx.signal.addEventListener("abort", letGo, { once: true });
    });
    let wrongWasCounted = false;
    let markWrongCounted = () => {};
    const wrongCounted = new Promise<void>((resolve) => (markWrongCounted = resolve));
    let wrongGuess: Promise<{ status: number }> | undefined;
    const hook = pauseCounts(
      ctx,
      async () => {
        // The owner's correct guess was counted fourth; the attacker's wrong one is counted fifth.
        const guess = attacker.client.post("/auth/2fa/validate", { code: wrongCode(owner.code) });
        wrongGuess = guess;
        // If the wrong guess is never counted, its request fails, or the test times out, carry
        // on rather than wait for ever. A failed request is reported below, where wrongGuess is
        // awaited.
        const settled = guess.then(
          () => undefined,
          () => undefined
        );
        await Promise.race([wrongCounted, settled, aborted]);
      },
      async () => {
        wrongWasCounted = true;
        markWrongCounted();
        await wrongHeld; // its lock write waits until the owner has logged in
      }
    );
    let res: { status: number };
    try {
      res = await owner.client.post("/auth/2fa/validate", { code: owner.code });
    } finally {
      releaseWrong();
      hook.mock.restore();
    }
    assert.equal(res.status, 200, "the owner logs in");
    assert.ok(
      wrongWasCounted,
      "the attacker's wrong guess was counted fifth during the owner's check"
    );
    assert.equal((await wrongGuess)?.status, 400);
    assert.ok(
      (await minutesUntilNextCode(email)) <= 1,
      "no 15-minute lock after the owner's login"
    );
    assert.deepEqual(
      await storedCount(email),
      { attempts: undefined, windowStart: undefined },
      "the owner's correct code cleared the count and the window"
    );
    const next = await startLogin(email);
    assert.equal(
      (await next.client.post("/auth/2fa/validate", { code: next.code })).status,
      200,
      "the next login gets a code that works"
    );
  }
);

test("A-01: when the window ends before the lock, new codes stay held back until the lock ends", async (ctx) => {
  const { email } = await userWith2FA();
  await withClock(ctx, async (tick) => {
    const first = await startLogin(email);
    await guessWrong(first.client, first.code, 1); // the window opens at T
    tick(9 * MIN);
    const second = await startLogin(email);
    await guessWrong(second.client, second.code, 4); // the fifth guess at T+9 locks until T+24
    tick(7 * MIN); // T+16: the window has ended, the lock hasn't
    assert.equal((await plainLogin(email)).sent, false, "the lock still holds");

    tick(8 * MIN + 1000); // just past T+24
    const after = await plainLogin(email);
    assert.equal(after.sent, true, "the lock has ended");
    const res = await after.client.post("/auth/2fa/validate", { code: after.code });
    assert.equal(res.status, 200);
  });
});

test("A-01: the window ends exactly 15 minutes after it opened, not a moment earlier", async (ctx) => {
  const { email: early } = await userWith2FA();
  const { email: onTime } = await userWith2FA();
  await withClock(ctx, async (tick) => {
    // Both windows open at T: one account has four wrong guesses, the other is locked by five.
    const a = await startLogin(early);
    await guessWrong(a.client, a.code, 4);
    const b = await startLogin(onTime);
    await guessWrong(b.client, b.code, 5);

    tick(15 * MIN - 1); // 1 ms before the windows end
    assert.equal((await plainLogin(onTime)).sent, false, "still locked");
    const a2 = await startLogin(early);
    await guessWrong(a2.client, a2.code, 1); // still the fifth guess in the first window
    const tooLate = await a2.client.post("/auth/2fa/validate", { code: a2.code });
    assert.equal(tooLate.status, 400);

    tick(1); // exactly T+15
    const b2 = await plainLogin(onTime);
    assert.equal(b2.sent, true, "on the dot, the lock and the window have ended");
    await guessWrong(b2.client, b2.code, 4); // the first of these opens a new window
    const res = await b2.client.post("/auth/2fa/validate", { code: b2.code });
    assert.equal(res.status, 200);
  });
});

test("A-01: an account from before the window field gets one fresh window, then the limit", async (ctx) => {
  const { email } = await userWith2FA();
  await withClock(ctx, async () => {
    const first = await startLogin(email);
    // As the previous version could leave it: a count of five, the code still there, no window.
    await t.UserModel.updateOne(
      { email },
      { $set: { twoFactorAttempts: 5 }, $unset: { twoFactorWindowStart: "" } }
    );

    await guessWrong(first.client, first.code, 1);
    assert.deepEqual(await storedCount(email), { attempts: 1, windowStart: new Date() });
    await guessWrong(first.client, first.code, 4); // the fifth in the new window
    const res = await first.client.post("/auth/2fa/validate", { code: first.code });
    assert.equal(res.status, 400);
    const minutes = await minutesUntilNextCode(email);
    assert.ok(minutes > 14 && minutes <= 15, "locked");
  });
});

test("A-01: a guess at an expired code isn't counted and opens no window", async () => {
  const { email } = await userWith2FA();
  const first = await startLogin(email);
  await t.UserModel.updateOne({ email }, { twoFactorExpires: new Date(Date.now() - 1000) });
  await guessWrong(first.client, first.code, 3);
  const correct = await first.client.post("/auth/2fa/validate", { code: first.code });
  assert.equal(correct.status, 400);
  assert.deepEqual(correct.body.error, {
    code: "VALIDATION_ERROR",
    message: "Invalid input",
    details: { code: ["Invalid or expired code"] },
  });
  assert.deepEqual(await storedCount(email), { attempts: undefined, windowStart: undefined });
});
