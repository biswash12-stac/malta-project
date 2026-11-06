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
let categoryId: string;
let ProductModel: typeof import("../src/modules/products/product.model.js").ProductModel;
let pricing: typeof import("../src/modules/products/product.pricing.js");
let productCount = 0;

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

const asAdmin = (method: string, path: string, body?: unknown) =>
  api(method, path, { body, cookie: adminCookie });

const registerCookie = async (email: string) => {
  const res = await fetch(`${base}/api/v1/auth/register`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ username: "Test", email, password: "password-123" }),
  });
  assert.equal(res.status, 201);
  return res.headers.getSetCookie()[0]?.split(";")[0] ?? "";
};

const body = (overrides: Record<string, unknown> = {}) => ({
  nameEn: `Item ${++productCount}`,
  nameNp: "सामान",
  price: 1000,
  unit: "1 kg",
  stock: 5,
  category: categoryId,
  ...overrides,
});

const create = async (overrides: Record<string, unknown> = {}) => {
  const { status, body: res } = await asAdmin("POST", "/products", body(overrides));
  assert.equal(status, 201, JSON.stringify(res));
  return res.data.product;
};

const createCategory = async (name: string) => {
  const { status, body: res } = await asAdmin("POST", "/categories", { name });
  assert.equal(status, 201);
  return res.data.category;
};

const publicSlugs = async (query = "limit=50") =>
  (await api("GET", `/products?${query}`)).body.data.items.map((p: { slug: string }) => p.slug);

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
  ({ ProductModel } = await import("../src/modules/products/product.model.js"));
  pricing = await import("../src/modules/products/product.pricing.js");
  await connectDB();
  await Promise.all([CategoryModel.init(), ProductModel.init(), UserModel.init()]);

  await new Promise<void>((resolve) => {
    server = app.listen(0, () => resolve());
  });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

  customerCookie = await registerCookie("customer@example.com");
  adminCookie = await registerCookie("admin@example.com");
  await UserModel.updateOne({ email: "admin@example.com" }, { role: "admin" });
  categoryId = (await createCategory("Groceries"))._id;
});

after(async () => {
  server.close();
  await mongoose.disconnect();
  await mongo.stop();
});

test("only admins can write or use the admin routes", async () => {
  const id = "507f1f77bcf86cd799439011";
  const routes = [
    ["POST", "/products", body()],
    ["PATCH", `/products/${id}`, { price: 1 }],
    ["DELETE", `/products/${id}`, undefined],
    ["GET", "/admin/products", undefined],
    ["GET", `/admin/products/${id}`, undefined],
  ] as const;
  for (const [method, path, payload] of routes) {
    assert.equal((await api(method, path, { body: payload })).status, 401, `${method} ${path}`);
    const asCustomer = await api(method, path, { body: payload, cookie: customerCookie });
    assert.equal(asCustomer.status, 403, `${method} ${path}`);
  }
});

test("the slug comes from nameEn and doesn't change on rename", async () => {
  const product = await create({ nameEn: "Basmati Rice 5kg", nameNp: "बासमती चामल" });
  assert.equal(product.slug, "basmati-rice-5kg");
  assert.equal(product.nameNp, "बासमती चामल");

  const renamed = await asAdmin("PATCH", `/products/${product._id}`, { nameEn: "Royal Basmati" });
  assert.equal(renamed.status, 200);
  assert.equal(renamed.body.data.product.nameEn, "Royal Basmati");
  assert.equal(renamed.body.data.product.slug, "basmati-rice-5kg");
  assert.equal((await api("GET", "/products/basmati-rice-5kg")).status, 200);
});

test("create rejects duplicates, client slugs, a missing category and old fields", async () => {
  await create({ nameEn: "Black Tea" });
  const duplicate = await asAdmin("POST", "/products", body({ nameEn: "BLACK tea" }));
  assert.equal(duplicate.status, 409);

  const unknownCategory = await asAdmin(
    "POST",
    "/products",
    body({ category: "507f1f77bcf86cd799439011" })
  );
  assert.equal(unknownCategory.status, 400);
  assert.ok(unknownCategory.body.error.details.category);

  for (const extra of [{ slug: "mine" }, { averageRating: 5 }, { priceHistory: [] }]) {
    const res = await asAdmin("POST", "/products", body(extra));
    assert.equal(res.status, 400, JSON.stringify(extra));
  }
  for (const extra of [{ priorLowestPrice: 9999 }, { slug: "changed" }]) {
    const product = await create();
    const res = await asAdmin("PATCH", `/products/${product._id}`, extra);
    assert.equal(res.status, 400, JSON.stringify(extra));
  }
});

test("public responses contain only public fields", async () => {
  const product = await create({
    description: "Full details",
    shopRating: 4.5,
    images: [{ url: "https://res.cloudinary.com/demo/image/upload/a.jpg", publicId: "secret-id" }],
  });

  const detail = await api("GET", `/products/${product.slug}`);
  const raw = JSON.stringify(detail.body);
  for (const hidden of ["priceHistory", "secret-id", "isActive", "createdAt", "__v"]) {
    assert.ok(!raw.includes(hidden), hidden);
  }
  const found = detail.body.data.product;
  assert.equal(found.description, "Full details");
  assert.equal(found.shopRating, 4.5);
  assert.equal(found.images[0].url, "https://res.cloudinary.com/demo/image/upload/a.jpg");
  assert.equal(found.category.name, "Groceries");

  const list = await api("GET", "/products?limit=50");
  const inList = list.body.data.items.find((p: { slug: string }) => p.slug === product.slug);
  assert.equal(inList.description, undefined, "lists don't send descriptions");

  const admin = await asAdmin("GET", `/admin/products/${product._id}`);
  assert.equal(admin.body.data.product.images[0].publicId, "secret-id");
  assert.equal(admin.body.data.product.isActive, true);
  assert.ok(!JSON.stringify(admin.body).includes("priceHistory"));
});

test("soft delete hides a product publicly, admins still see it, and it can return", async () => {
  const product = await create();
  assert.ok((await publicSlugs()).includes(product.slug));

  assert.equal((await asAdmin("DELETE", `/products/${product._id}`)).status, 200);
  assert.ok(!(await publicSlugs()).includes(product.slug));
  assert.equal((await api("GET", `/products/${product.slug}`)).status, 404);

  const admin = await asAdmin("GET", "/admin/products?isActive=false&limit=50");
  assert.ok(admin.body.data.items.some((p: { _id: string }) => p._id === product._id));

  await asAdmin("PATCH", `/products/${product._id}`, { isActive: true });
  assert.ok((await publicSlugs()).includes(product.slug));

  const missing = "507f1f77bcf86cd799439011";
  assert.equal((await asAdmin("DELETE", `/products/${missing}`)).status, 404);
  assert.equal((await asAdmin("PATCH", `/products/${missing}`, { stock: 1 })).status, 404);
  assert.equal((await asAdmin("GET", `/admin/products/${missing}`)).status, 404);
});

test("hiding a category hides its products everywhere until it is reactivated", async () => {
  const category = await createCategory("Pickles");
  const visible = await create({
    nameEn: "Mango Pickle",
    category: category._id,
    isFeatured: true,
  });
  const hiddenAlone = await create({ nameEn: "Radish Pickle", category: category._id });
  await asAdmin("DELETE", `/products/${hiddenAlone._id}`);

  await asAdmin("DELETE", `/categories/${category._id}`);

  assert.ok(!(await publicSlugs()).includes(visible.slug), "list");
  assert.ok(!(await publicSlugs("featured=true&limit=50")).includes(visible.slug), "featured");
  assert.deepEqual(await publicSlugs("q=mango"), [], "search");
  assert.deepEqual(await publicSlugs("category=pickles"), [], "category filter");
  assert.equal((await api("GET", `/products/${visible.slug}`)).status, 404, "detail");

  const admin = await asAdmin("GET", `/admin/products/${visible._id}`);
  assert.equal(admin.status, 200, "admins still see it");
  assert.equal(admin.body.data.product.isActive, true, "the product itself is unchanged");

  await asAdmin("PATCH", `/categories/${category._id}`, { isActive: true });
  assert.ok((await publicSlugs()).includes(visible.slug));
  assert.ok(!(await publicSlugs()).includes(hiddenAlone.slug), "stays hidden on its own");
});

test("search covers both names and the description; filters and pages work", async () => {
  const category = await createCategory("Spices");
  const turmeric = await create({
    nameEn: "Turmeric Powder",
    nameNp: "बेसार",
    category: category._id,
    isFeatured: true,
  });
  const cumin = await create({
    nameEn: "Cumin Seeds",
    nameNp: "जीरा",
    description: "Earthy seasoning",
    category: category._id,
  });

  assert.deepEqual(await publicSlugs("q=turmeric"), [turmeric.slug]);
  assert.deepEqual(await publicSlugs(`q=${encodeURIComponent("बेसार")}`), [turmeric.slug]);
  assert.deepEqual(await publicSlugs("q=seasoning"), [cumin.slug]);
  assert.deepEqual((await publicSlugs("category=SPICES")).sort(), [cumin.slug, turmeric.slug]);
  assert.deepEqual(await publicSlugs("category=spices&featured=true"), [turmeric.slug]);
  assert.deepEqual(await publicSlugs("category=no-such-category"), []);

  const first = await api("GET", "/products?category=spices&limit=1");
  const second = await api("GET", "/products?category=spices&limit=1&page=2");
  assert.equal(first.body.data.pagination.total, 2);
  assert.equal(first.body.data.pagination.totalPages, 2);
  assert.equal(first.body.data.items[0].slug, cumin.slug, "newest first");
  assert.equal(second.body.data.items[0].slug, turmeric.slug);

  const admin = await asAdmin("GET", `/admin/products?category=${category._id}&q=cumin`);
  assert.deepEqual(
    admin.body.data.items.map((p: { slug: string }) => p.slug),
    [cumin.slug]
  );
});

test("query and param validation, including injection attempts", async () => {
  for (const query of [
    "page=abc",
    "limit=51",
    "featured=false",
    "isActive=false",
    "price[$ne]=0",
    "category[$ne]=x",
    "q[$regex]=.*",
    "q=",
    `q=${"x".repeat(101)}`,
    "$where=1",
  ]) {
    assert.equal((await api("GET", `/products?${query}`)).status, 400, query);
  }
  assert.equal((await asAdmin("GET", "/admin/products?category=abc")).status, 400);
  assert.equal((await asAdmin("GET", "/admin/products?isActive=maybe")).status, 400);
  assert.equal((await asAdmin("GET", "/admin/products/abc")).status, 400);
  assert.equal((await asAdmin("PATCH", "/products/abc", { stock: 1 })).status, 400);
  assert.equal((await asAdmin("DELETE", "/products/abc")).status, 400);
  assert.equal(
    (await asAdmin("POST", "/products", body({ nameEn: { $gt: "" } }))).status,
    400,
    "operator in body"
  );
});

test("an offer stores the lowest recent price as its reference", async () => {
  const product = await create({ price: 1000 });
  assert.equal(product.priorLowestPrice, null);
  const path = `/products/${product._id}`;

  const onOffer = await asAdmin("PATCH", path, { offerPrice: 800 });
  assert.equal(onOffer.body.data.product.priorLowestPrice, 1000);

  const lowered = await asAdmin("PATCH", path, { offerPrice: 700 });
  assert.equal(lowered.body.data.product.priorLowestPrice, 1000, "kept through step-downs");

  const ended = await asAdmin("PATCH", path, { offerPrice: null });
  assert.equal(ended.body.data.product.priorLowestPrice, null);

  // The 700 offer is within the last 30 days, so a "reduction" to 750 wouldn't be genuine.
  const fake = await asAdmin("PATCH", path, { offerPrice: 750 });
  assert.equal(fake.status, 400);
  assert.ok(fake.body.error.details.offerPrice);

  const genuine = await asAdmin("PATCH", path, { offerPrice: 650 });
  assert.equal(genuine.body.data.product.priorLowestPrice, 700);
});

test("raising the price just before an offer can't inflate the reference", async () => {
  const product = await create({ price: 1000 });
  const path = `/products/${product._id}`;
  await asAdmin("PATCH", path, { price: 2000 });

  const inflated = await asAdmin("PATCH", path, { offerPrice: 1500 });
  assert.equal(inflated.status, 400, "1500 is above the 1000 charged days ago");

  const real = await asAdmin("PATCH", path, { offerPrice: 900 });
  assert.equal(real.body.data.product.priorLowestPrice, 1000);
});

test("the offer must stay below the price when either is edited", async () => {
  const product = await create({ price: 1000, offerPrice: 800 });
  assert.equal(product.priorLowestPrice, 1000);
  const path = `/products/${product._id}`;

  const tooHigh = await asAdmin("PATCH", path, { offerPrice: 1000 });
  assert.equal(tooHigh.status, 400);

  const priceTooLow = await asAdmin("PATCH", path, { price: 700 });
  assert.equal(priceTooLow.status, 400);
  assert.ok(priceTooLow.body.error.details.offerPrice);

  const stored = await ProductModel.findById(product._id).lean();
  assert.equal(stored?.price, 1000, "a rejected edit changes nothing");
  assert.equal(stored?.offerPrice, 800);
});

test("the 30-day window keeps only what it needs and uses the price then in effect", () => {
  const now = new Date("2026-06-30T00:00:00Z");
  const daysAgo = (days: number) => new Date(now.getTime() - days * 86_400_000);
  const history = [
    { price: 100, from: daysAgo(90) },
    { price: 500, from: daysAgo(45) },
    { price: 900, from: daysAgo(10) },
  ];

  assert.deepEqual(
    pricing.pricesInWindow(history, now).map((r) => r.price),
    [500, 900],
    "the 100 ended before the window opened, and the 500 was still in effect"
  );

  const product = { price: 1000, offerPrice: 450, priorLowestPrice: null, priceHistory: history };
  pricing.applyPriceRules(product, 900, now);
  assert.equal(product.priorLowestPrice, 500);
  assert.deepEqual(
    product.priceHistory.map((r) => r.price),
    [500, 900, 450],
    "records the new price and drops expired ones"
  );
});

test("a change that doesn't affect the price adds no history", async () => {
  const product = await create({ price: 1000 });
  await asAdmin("PATCH", `/products/${product._id}`, { stock: 99 });
  await asAdmin("PATCH", `/products/${product._id}`, { nameNp: "नयाँ" });
  const stored = await ProductModel.findById(product._id).select("+priceHistory").lean();
  assert.equal(stored?.priceHistory.length, 1);
  assert.equal(stored?.stock, 99);
});
