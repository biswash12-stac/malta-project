import assert from "node:assert/strict";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { after, before, test } from "node:test";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";

let mongo: MongoMemoryServer;
let server: Server;
let base: string;
let adminCookie: string;
let customerCookie: string;

type ApiResult = { status: number; body: any };

const api = async (
  method: string,
  path: string,
  { body, cookie }: { body?: unknown; cookie?: string } = {}
): Promise<ApiResult> => {
  const res = await fetch(`${base}/api/v1${path}`, {
    method,
    headers: {
      ...(body !== undefined && { "content-type": "application/json" }),
      ...(cookie && { cookie }),
    },
    ...(body !== undefined && { body: JSON.stringify(body) }),
  });
  return { status: res.status, body: await res.json() };
};

const registerCookie = async (email: string) => {
  const res = await fetch(`${base}/api/v1/auth/register`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ username: "Test", email, password: "password-123" }),
  });
  assert.equal(res.status, 201);
  return res.headers.getSetCookie()[0]?.split(";")[0] ?? "";
};

const createCategory = async (name: string) => {
  const { status, body } = await api("POST", "/categories", {
    body: { name },
    cookie: adminCookie,
  });
  assert.equal(status, 201);
  return body.data.category;
};

const publicNames = async () =>
  (await api("GET", "/categories?limit=50")).body.data.items.map((c: { name: string }) => c.name);

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
  const { CategoryModel } = await import("../src/modules/categories/category.model.js");
  await connectDB();
  await CategoryModel.init();

  await new Promise<void>((resolve) => {
    server = app.listen(0, () => resolve());
  });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

  customerCookie = await registerCookie("customer@example.com");
  adminCookie = await registerCookie("admin@example.com");
  await UserModel.updateOne({ email: "admin@example.com" }, { role: "admin" });
});

after(async () => {
  server.close();
  await mongoose.disconnect();
  await mongo.stop();
});

test("only admins can write or see the admin list", async () => {
  const fakeId = "507f1f77bcf86cd799439011";
  const routes = [
    ["POST", "/categories", { name: "Nope" }],
    ["PATCH", `/categories/${fakeId}`, { name: "Nope" }],
    ["DELETE", `/categories/${fakeId}`, undefined],
    ["GET", "/admin/categories", undefined],
  ] as const;

  for (const [method, path, body] of routes) {
    assert.equal((await api(method, path, { body })).status, 401, `${method} ${path}`);
    const asCustomer = await api(method, path, { body, cookie: customerCookie });
    assert.equal(asCustomer.status, 403, `${method} ${path}`);
  }
  assert.ok(!(await publicNames()).includes("Nope"));
});

test("create builds the slug, including for Nepali names", async () => {
  const category = await createCategory("  Rice & Grains  ");
  assert.equal(category.name, "Rice & Grains");
  assert.equal(category.slug, "rice-grains");
  assert.equal(category.isActive, true);
  assert.ok(category._id);

  assert.equal((await createCategory("मसला र अचार")).slug, "मसला-र-अचार");
});

test("create rejects bad input", async () => {
  const cookie = adminCookie;
  for (const body of [
    {},
    { name: "" },
    { name: "!!!" },
    { name: "x".repeat(101) },
    { name: { $gt: "" } },
    { name: "Extra", slug: "chosen-by-client" },
    { name: "Extra", isActive: false },
  ]) {
    const res = await api("POST", "/categories", { body, cookie });
    assert.equal(res.status, 400, JSON.stringify(body));
    assert.equal(res.body.error.code, "VALIDATION_ERROR");
  }
});

test("duplicate names conflict, ignoring case and spacing, even in parallel", async () => {
  await createCategory("Lentils");
  const duplicate = await api("POST", "/categories", {
    body: { name: "LENTILS " },
    cookie: adminCookie,
  });
  assert.equal(duplicate.status, 409);
  assert.equal(duplicate.body.error.code, "CONFLICT");

  const results = await Promise.all(
    [1, 2].map(() =>
      api("POST", "/categories", { body: { name: "Parallel" }, cookie: adminCookie })
    )
  );
  assert.deepEqual(results.map((r) => r.status).sort(), [201, 409]);
});

test("update renames with a new slug, and blocks collisions", async () => {
  const category = await createCategory("Old Name");
  const path = `/categories/${category._id}`;

  const renamed = await api("PATCH", path, { body: { name: "New Name" }, cookie: adminCookie });
  assert.equal(renamed.status, 200);
  assert.equal(renamed.body.data.category.slug, "new-name");
  assert.equal(renamed.body.data.category.isActive, true);

  await createCategory("Taken");
  const collision = await api("PATCH", path, { body: { name: "taken" }, cookie: adminCookie });
  assert.equal(collision.status, 409);
});

test("update rejects a bad id, a missing category and an empty body", async () => {
  const cookie = adminCookie;
  const bad = await api("PATCH", "/categories/abc", { body: { name: "X" }, cookie });
  assert.equal(bad.status, 400);

  const missing = await api("PATCH", "/categories/507f1f77bcf86cd799439011", {
    body: { name: "X" },
    cookie,
  });
  assert.equal(missing.status, 404);

  const category = await createCategory("Empty Patch");
  const empty = await api("PATCH", `/categories/${category._id}`, { body: {}, cookie });
  assert.equal(empty.status, 400);
  assert.ok(empty.body.error.details._form);
});

test("delete hides a category publicly, admins still see it, and it can return", async () => {
  const category = await createCategory("Seasonal");
  const path = `/categories/${category._id}`;
  assert.ok((await publicNames()).includes("Seasonal"));

  assert.equal((await api("DELETE", path, { cookie: adminCookie })).status, 200);
  assert.ok(!(await publicNames()).includes("Seasonal"));

  const adminList = await api("GET", "/admin/categories?limit=50", { cookie: adminCookie });
  const hidden = adminList.body.data.items.find((c: { name: string }) => c.name === "Seasonal");
  assert.equal(hidden.isActive, false);

  // Deleting twice is safe, and a missing id is a 404.
  assert.equal((await api("DELETE", path, { cookie: adminCookie })).status, 200);
  const missing = await api("DELETE", "/categories/507f1f77bcf86cd799439011", {
    cookie: adminCookie,
  });
  assert.equal(missing.status, 404);

  await api("PATCH", path, { body: { isActive: true }, cookie: adminCookie });
  assert.ok((await publicNames()).includes("Seasonal"));
});

test("the public list returns only public fields, sorted and paginated", async () => {
  const first = await api("GET", "/categories?limit=2");
  assert.equal(first.status, 200);
  assert.equal(first.body.data.items.length, 2);
  assert.deepEqual(Object.keys(first.body.data.items[0]).sort(), ["_id", "name", "slug"]);

  const { page, limit, total, totalPages } = first.body.data.pagination;
  assert.deepEqual([page, limit], [1, 2]);
  assert.ok(total > 2);
  assert.equal(totalPages, Math.ceil(total / 2));

  const second = await api("GET", "/categories?limit=2&page=2");
  const names = [...first.body.data.items, ...second.body.data.items].map(
    (c: { name: string }) => c.name
  );
  assert.deepEqual(names, [...names].sort());
  assert.equal(new Set(names).size, 4, "pages don't overlap");
});

test("public list params are validated", async () => {
  for (const query of ["page=abc", "limit=51", "isActive=false", "name[$ne]=x"]) {
    assert.equal((await api("GET", `/categories?${query}`)).status, 400, query);
  }
});
