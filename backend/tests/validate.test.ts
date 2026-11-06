import assert from "node:assert/strict";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { after, before, test } from "node:test";
import express from "express";

let server: Server;
let base: string;

const getJson = async (path: string) => {
  const res = await fetch(base + path);
  return { status: res.status, body: await res.json() };
};

const postLogin = async (body: unknown) => {
  const res = await fetch(`${base}/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  return { status: res.status, body: await res.json() };
};

before(async () => {
  // This test needs no database. The address below is never connected to.
  process.env.MONGODB_URI = "mongodb://127.0.0.1:1/unused";
  process.env.JWT_SECRET = "test-secret-".repeat(4);
  process.env.NODE_ENV = "test";
  process.env.LOG_LEVEL = "fatal";

  const { validateRequest } = await import("../src/middlewares/validate.middleware.js");
  const { errorHandler } = await import("../src/middlewares/error.middleware.js");
  const { objectIdParamSchema, paginationQuerySchema } =
    await import("../src/utils/common.schema.js");
  const { loginSchema } = await import("../src/modules/auth/auth.schema.js");

  const app = express();
  app.use(express.json());
  app.get("/items", validateRequest({ query: paginationQuerySchema }), (req, res) => {
    res.json({ query: req.query });
  });
  app.get("/items/:id", validateRequest({ params: objectIdParamSchema }), (req, res) => {
    res.json({ params: req.params });
  });
  app.post("/login", validateRequest({ body: loginSchema }), (req, res) => {
    res.json({ body: req.body });
  });
  app.use(errorHandler);

  await new Promise<void>((resolve) => {
    server = app.listen(0, () => resolve());
  });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

after(() => {
  server.close();
});

test("query params reach the handler as numbers, with defaults", async () => {
  assert.deepEqual((await getJson("/items")).body.query, { page: 1, limit: 20 });
  assert.deepEqual((await getJson("/items?page=3&limit=50")).body.query, { page: 3, limit: 50 });
});

test("bad page and limit values return a 400 naming the field", async () => {
  const cases = [
    ["page=abc", "page"],
    ["page=0", "page"],
    ["page=-1", "page"],
    ["page=1.5", "page"],
    ["page=1e3", "page"],
    ["page=0x10", "page"],
    ["page=", "page"],
    ["page=10001", "page"],
    ["page=1&page=2", "page"],
    ["page=99999999999999999999", "page"],
    ["limit=51", "limit"],
    ["limit=0", "limit"],
  ] as const;

  for (const [query, field] of cases) {
    const { status, body } = await getJson(`/items?${query}`);
    assert.equal(status, 400, query);
    assert.equal(body.error.code, "VALIDATION_ERROR", query);
    assert.ok(body.error.details[field], query);
  }
});

test("operator-style and unknown query params are rejected", async () => {
  for (const query of ["page[$gt]=1", "price[$ne]=0", "$where=1", "foo=bar"]) {
    const { status, body } = await getJson(`/items?${query}`);
    assert.equal(status, 400, query);
    assert.ok(body.error.details._form, query);
  }
});

test("a malformed id returns a 400 and a valid one passes", async () => {
  for (const id of ["abc", "507f1f77bcf86cd79943901", "507f1f77bcf86cd79943901z"]) {
    assert.equal((await getJson(`/items/${id}`)).status, 400, id);
  }
  const id = "507f1f77bcf86cd799439011";
  assert.deepEqual((await getJson(`/items/${id}`)).body.params, { id });
});

test("a body using query operators can't reach a query", async () => {
  const injected = await postLogin({ email: { $gt: "" }, password: { $ne: null } });
  assert.equal(injected.status, 400);
  assert.ok(injected.body.error.details.email);
  assert.ok(injected.body.error.details.password);
});

test("a non-object body returns a 400 with a reason", async () => {
  const { status, body } = await postLogin(["not", "an", "object"]);
  assert.equal(status, 400);
  assert.ok(body.error.details._form);
});

test("a valid body is trimmed and lowercased for the handler", async () => {
  const { status, body } = await postLogin({ email: " SITA@Example.com ", password: "x" });
  assert.equal(status, 200);
  assert.equal(body.body.email, "sita@example.com");
});
