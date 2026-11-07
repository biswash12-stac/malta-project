import assert from "node:assert/strict";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { after, before, mock, test } from "node:test";
import mongoose from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";

let mongo: MongoMemoryReplSet;
let server: Server;
let base: string;
let adminCookie: string;
let customerCookie: string;
let otherCookie: string;
let categoryId: string;
let ProductModel: typeof import("../src/modules/products/product.model.js").ProductModel;
let OrderModel: typeof import("../src/modules/orders/order.model.js").OrderModel;
let CategoryModel: typeof import("../src/modules/categories/category.model.js").CategoryModel;
let nextOrderNumber: typeof import("../src/modules/orders/order-number.js").nextOrderNumber;

let nextIp = 1;
let productCount = 0;

const delivery = {
  name: "Sita",
  phone: "+356 7912 3456",
  address: "12 Triq il-Kbira",
  locality: "Birkirkara",
};

const api = async (
  method: string,
  path: string,
  { body, cookie, ip }: { body?: unknown; cookie?: string; ip?: string } = {}
): Promise<{ status: number; body: any; setCookies: string[] }> => {
  const res = await fetch(`${base}/api/v1${path}`, {
    method,
    headers: {
      // Its own IP per request unless a test sets one, so only the rate limit test hits the limits.
      "x-forwarded-for": ip ?? `10.${(nextIp >> 8) & 255}.${nextIp++ & 255}.1`,
      ...(body !== undefined && { "content-type": "application/json" }),
      ...(cookie && { cookie }),
    },
    ...(body !== undefined && { body: JSON.stringify(body) }),
  });
  return { status: res.status, body: await res.json(), setCookies: res.headers.getSetCookie() };
};

const register = async (email: string) => {
  const res = await api("POST", "/auth/register", {
    body: { username: "Test", email, password: "password-123" },
  });
  assert.equal(res.status, 201);
  return res.setCookies[0]?.split(";")[0] ?? "";
};

const makeProduct = (overrides: Record<string, unknown> = {}) => {
  const n = ++productCount;
  return ProductModel.create({
    nameEn: `Rice ${n}`,
    nameNp: "चामल",
    slug: `rice-${n}`,
    price: 2000,
    unit: "1 kg",
    stock: 5,
    category: categoryId,
    ...overrides,
  });
};

const stockOf = async (id: unknown) => (await ProductModel.findById(id).lean())?.stock;

const place = (
  items: { productId: unknown; qty: number }[],
  cookie = customerCookie,
  ip?: string
) =>
  api("POST", "/orders", {
    body: { items: items.map((i) => ({ ...i, productId: String(i.productId) })), delivery },
    cookie,
    ...(ip && { ip }),
  });

const placeOne = async (cookie = customerCookie) => {
  const product = await makeProduct();
  const res = await place([{ productId: product._id, qty: 2 }], cookie);
  assert.equal(res.status, 201, JSON.stringify(res.body));
  return { order: res.body.data.order, product };
};

const asAdmin = (method: string, path: string, body?: unknown) =>
  api(method, path, { body, cookie: adminCookie });

const setStatus = (id: string, status: string, note?: string) =>
  asAdmin("PATCH", `/admin/orders/${id}/status`, { status, ...(note && { note }) });

const advanceTo = async (id: string, ...statuses: string[]) => {
  for (const status of statuses) assert.equal((await setStatus(id, status)).status, 200, status);
};

before(async () => {
  // Transactions need a replica set.
  mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  // Set before the app loads, so tests can never touch the database in .env.
  process.env.MONGODB_URI = mongo.getUri("test");
  process.env.JWT_SECRET = "test-secret-".repeat(4);
  process.env.NODE_ENV = "test";
  process.env.LOG_LEVEL = "fatal";
  process.env.TRUST_PROXY_HOPS = "1";

  const { app } = await import("../src/app.js");
  const { connectDB } = await import("../src/config/db.js");
  const { UserModel } = await import("../src/modules/users/user.model.js");
  ({ CategoryModel } = await import("../src/modules/categories/category.model.js"));
  ({ ProductModel } = await import("../src/modules/products/product.model.js"));
  ({ OrderModel } = await import("../src/modules/orders/order.model.js"));
  ({ nextOrderNumber } = await import("../src/modules/orders/order-number.js"));
  await connectDB();

  await new Promise<void>((resolve) => {
    server = app.listen(0, () => resolve());
  });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

  customerCookie = await register("customer@example.com");
  otherCookie = await register("other@example.com");
  adminCookie = await register("admin@example.com");
  await UserModel.updateOne({ email: "admin@example.com" }, { role: "admin" });
  categoryId = String((await CategoryModel.create({ name: "Rice", slug: "rice" }))._id);
});

after(async () => {
  server.close();
  await mongoose.disconnect();
  await mongo.stop();
});

test("ordering needs a login, and admin routes need an admin", async () => {
  const id = "507f1f77bcf86cd799439011";
  assert.equal((await api("POST", "/orders", { body: { items: [], delivery } })).status, 401);
  assert.equal((await api("GET", "/orders/mine")).status, 401);
  assert.equal((await api("GET", `/orders/${id}`)).status, 401);

  const routes = [
    ["GET", "/admin/orders", undefined],
    ["GET", `/admin/orders/${id}`, undefined],
    ["PATCH", `/admin/orders/${id}/status`, { status: "confirmed" }],
    ["PATCH", `/admin/orders/${id}/delivery-date`, { estimatedDeliveryDate: null }],
    ["PATCH", `/admin/orders/${id}/payment`, { paymentStatus: "paid" }],
  ] as const;
  for (const [method, path, body] of routes) {
    assert.equal((await api(method, path, { body })).status, 401, path);
    assert.equal((await api(method, path, { body, cookie: customerCookie })).status, 403, path);
  }
});

test("the client can't send prices, a delivery fee or a total", async () => {
  const product = await makeProduct();
  const items = [{ productId: String(product._id), qty: 1 }];
  for (const extra of [
    { deliveryFee: 0 },
    { total: 1 },
    { subtotal: 1 },
    { paymentStatus: "paid" },
  ]) {
    const res = await api("POST", "/orders", {
      body: { items, delivery, ...extra },
      cookie: customerCookie,
    });
    assert.equal(res.status, 400, JSON.stringify(extra));
  }
  const priced = await api("POST", "/orders", {
    body: { items: [{ ...items[0], priceSnapshot: 1 }], delivery },
    cookie: customerCookie,
  });
  assert.equal(priced.status, 400);
  assert.equal(await stockOf(product._id), 5);
});

test("bad checkout input returns a 400", async () => {
  const product = await makeProduct();
  const productId = String(product._id);
  const cases = [
    { items: [], delivery },
    { items: [{ productId, qty: 0 }], delivery },
    { items: [{ productId, qty: 1.5 }], delivery },
    { items: [{ productId: "not-an-id", qty: 1 }], delivery },
    {
      items: [
        { productId, qty: 1 },
        { productId: productId.toUpperCase(), qty: 1 },
      ],
      delivery,
    },
    { items: [{ productId, qty: 1 }], delivery: { ...delivery, phone: "call me" } },
    { items: [{ productId, qty: 1 }], delivery: { ...delivery, locality: "  " } },
    { items: [{ productId, qty: 1 }], delivery: { ...delivery, name: undefined } },
    { items: [{ productId, qty: 1 }], delivery: { ...delivery, address: undefined } },
  ];
  for (const body of cases) {
    const res = await api("POST", "/orders", { body, cookie: customerCookie });
    assert.equal(res.status, 400, JSON.stringify(body));
  }
});

test("subtotals below the €20.00 minimum are rejected and take no stock", async () => {
  const product = await makeProduct({ price: 1999 });
  const res = await place([{ productId: product._id, qty: 1 }]);
  assert.equal(res.status, 400);
  assert.equal(res.body.error.code, "MINIMUM_ORDER_NOT_MET");
  assert.deepEqual(res.body.error.details, { minimum: 2000, subtotal: 1999 });
  assert.equal(await stockOf(product._id), 5);
});

test("delivery costs €5.00 below €30.00 and is free from €30.00", async () => {
  const cases = [
    { price: 2000, deliveryFee: 500, total: 2500 },
    { price: 2999, deliveryFee: 500, total: 3499 },
    { price: 3000, deliveryFee: 0, total: 3000 },
  ];
  for (const { price, deliveryFee, total } of cases) {
    const product = await makeProduct({ price });
    const res = await place([{ productId: product._id, qty: 1 }]);
    assert.equal(res.status, 201);
    const { order } = res.body.data;
    assert.deepEqual([order.subtotal, order.deliveryFee, order.total], [price, deliveryFee, total]);
  }
});

test("an order charges the offer price, takes stock and starts pending COD", async () => {
  const a = await makeProduct({ price: 1000, offerPrice: 800, stock: 10 });
  const b = await makeProduct({ price: 1500, stock: 4 });
  const res = await place([
    { productId: a._id, qty: 3 },
    { productId: b._id, qty: 1 },
  ]);
  assert.equal(res.status, 201);
  const { order } = res.body.data;

  assert.equal(order.subtotal, 3900);
  assert.equal(order.deliveryFee, 0);
  assert.equal(order.total, 3900);
  assert.equal(order.status, "pending");
  assert.equal(order.paymentMethod, "COD");
  assert.equal(order.paymentStatus, "pending");
  assert.match(order.orderNumber, /^NG-\d{8}-\d{4}$/);
  assert.equal(order.delivery.phone, "79123456");
  assert.deepEqual(
    order.items.find((i: { productId: string }) => i.productId === String(a._id)),
    {
      productId: String(a._id),
      nameSnapshot: a.nameEn,
      unitSnapshot: "1 kg",
      priceSnapshot: 800,
      qty: 3,
    }
  );
  assert.equal(await stockOf(a._id), 7);
  assert.equal(await stockOf(b._id), 3);
});

test("snapshots keep the order unchanged when the product changes later", async () => {
  const { order, product } = await placeOne();
  await ProductModel.updateOne({ _id: product._id }, { nameEn: "Renamed", price: 9999 });
  const res = await api("GET", `/orders/${order._id}`, { cookie: customerCookie });
  assert.equal(res.body.data.order.items[0].nameSnapshot, product.nameEn);
  assert.equal(res.body.data.order.items[0].priceSnapshot, 2000);
});

test("missing, hidden and short-stock products are reported together", async () => {
  const short = await makeProduct({ stock: 1, price: 5000 });
  const inactive = await makeProduct({ isActive: false, price: 5000 });
  const hiddenCategory = await CategoryModel.create({
    name: "Hidden",
    slug: "hidden",
    isActive: false,
  });
  const hidden = await makeProduct({ category: hiddenCategory._id, price: 5000 });
  const available = await makeProduct({ price: 5000 });
  const missing = "507f1f77bcf86cd799439011";

  const res = await place([
    { productId: short._id, qty: 2 },
    { productId: inactive._id, qty: 1 },
    { productId: hidden._id, qty: 1 },
    { productId: missing, qty: 1 },
    { productId: available._id, qty: 1 },
  ]);
  assert.equal(res.status, 409);
  assert.equal(res.body.error.code, "ITEMS_UNAVAILABLE");
  assert.deepEqual(res.body.error.details.items, [
    { productId: String(short._id), available: 1 },
    { productId: String(inactive._id), available: 0 },
    { productId: String(hidden._id), available: 0 },
    { productId: missing, available: 0 },
  ]);
  assert.equal(await stockOf(available._id), 5);
  assert.equal(await stockOf(short._id), 1);
});

test("parallel orders can't oversell and all get different numbers", async () => {
  const product = await makeProduct({ stock: 3 });
  const results = await Promise.all(
    Array.from({ length: 6 }, () => place([{ productId: product._id, qty: 1 }]))
  );
  const placed = results.filter((r) => r.status === 201);
  assert.equal(placed.length, 3);
  for (const r of results.filter((r) => r.status !== 201)) assert.equal(r.status, 409);
  assert.equal(await stockOf(product._id), 0);
  const numbers = placed.map((r) => r.body.data.order.orderNumber);
  assert.equal(new Set(numbers).size, 3);
});

test("stock is returned if saving the order fails", async () => {
  const product = await makeProduct();
  const saveMock = mock.method(OrderModel.prototype, "save", async () => {
    throw new Error("disk full");
  });
  try {
    const res = await place([{ productId: product._id, qty: 2 }]);
    assert.equal(res.status, 500);
  } finally {
    saveMock.mock.restore();
  }
  assert.equal(await stockOf(product._id), 5);
});

test("order numbers use Malta's date and count up within the day", async () => {
  // 23:30 UTC on 1 March is already 2 March in Malta.
  const now = new Date("2030-03-01T23:30:00Z");
  assert.equal(await nextOrderNumber(now), "NG-20300302-0001");
  assert.equal(await nextOrderNumber(now), "NG-20300302-0002");
});

test("customers only see their own orders, without internal history", async () => {
  const { order } = await placeOne();
  await setStatus(order._id, "confirmed", "internal note");
  await asAdmin("PATCH", `/admin/orders/${order._id}/delivery-date`, {
    estimatedDeliveryDate: "2030-01-15",
  });

  const res = await api("GET", `/orders/${order._id}`, { cookie: customerCookie });
  assert.equal(res.status, 200);
  const shown = res.body.data.order;
  assert.equal(shown.user, undefined);
  assert.equal(shown.estimatedDeliveryDate, "2030-01-15T00:00:00.000Z");
  assert.deepEqual(
    shown.statusHistory.map((h: { status: string }) => h.status),
    ["pending", "confirmed"]
  );
  for (const entry of shown.statusHistory) {
    assert.deepEqual(Object.keys(entry).sort(), ["at", "status"]);
  }

  assert.equal((await api("GET", `/orders/${order._id}`, { cookie: otherCookie })).status, 404);
  assert.equal((await api("GET", "/orders/not-an-id", { cookie: customerCookie })).status, 400);
});

test("My Orders lists only the user's orders, newest first, with pagination", async () => {
  const cookie = await register("mine@example.com");
  const first = (await placeOne(cookie)).order;
  const second = (await placeOne(cookie)).order;
  await placeOne(otherCookie);

  const res = await api("GET", "/orders/mine", { cookie });
  assert.equal(res.status, 200);
  assert.deepEqual(
    res.body.data.items.map((o: { _id: string }) => o._id),
    [second._id, first._id]
  );
  assert.equal(res.body.data.pagination.total, 2);
  assert.equal((await api("GET", "/orders/mine?limit=1", { cookie })).body.data.items.length, 1);
  assert.equal((await api("GET", "/orders/mine?page=abc", { cookie })).status, 400);
  assert.equal((await api("GET", "/orders/mine?user[$ne]=x", { cookie })).status, 400);
});

test("the status can only follow the allowed path, and each step is logged", async () => {
  const { order } = await placeOne();

  for (const jump of ["packed", "out_for_delivery", "delivered", "pending"]) {
    const res = await setStatus(order._id, jump);
    assert.equal(res.status, 409, jump);
    assert.equal(res.body.error.code, "INVALID_STATUS_TRANSITION");
  }
  assert.equal((await setStatus(order._id, "shipped")).status, 400);

  await advanceTo(order._id, "confirmed", "packed", "out_for_delivery");
  const res = await setStatus(order._id, "delivered", "Left with neighbour");
  assert.equal(res.status, 200);
  const { statusHistory } = res.body.data.order;
  assert.deepEqual(
    statusHistory.map((h: { status: string }) => h.status),
    ["pending", "confirmed", "packed", "out_for_delivery", "delivered"]
  );
  assert.equal(statusHistory.at(-1).note, "Left with neighbour");
  assert.ok(statusHistory.at(-1).by);
  assert.equal((await setStatus(order._id, "cancelled")).status, 409);
});

test("cancelling returns stock only once, and only before packing", async () => {
  const pending = await placeOne();
  assert.equal(await stockOf(pending.product._id), 3);
  assert.equal((await setStatus(pending.order._id, "cancelled")).status, 200);
  assert.equal(await stockOf(pending.product._id), 5);
  assert.equal((await setStatus(pending.order._id, "cancelled")).status, 409);
  assert.equal(await stockOf(pending.product._id), 5);

  const confirmed = await placeOne();
  await advanceTo(confirmed.order._id, "confirmed");
  assert.equal((await setStatus(confirmed.order._id, "cancelled")).status, 200);
  assert.equal(await stockOf(confirmed.product._id), 5);

  const packed = await placeOne();
  await advanceTo(packed.order._id, "confirmed", "packed");
  assert.equal((await setStatus(packed.order._id, "cancelled")).status, 409);
  assert.equal(await stockOf(packed.product._id), 3);
});

test("parallel cancels return stock only once", async () => {
  const { order, product } = await placeOne();
  const results = await Promise.all([
    setStatus(order._id, "cancelled"),
    setStatus(order._id, "cancelled"),
    setStatus(order._id, "cancelled"),
  ]);
  assert.deepEqual(results.map((r) => r.status).sort(), [200, 409, 409]);
  assert.equal(await stockOf(product._id), 5);
});

test("the delivery date can be set, cleared and is logged, until the order is final", async () => {
  const { order } = await placeOne();
  const path = `/admin/orders/${order._id}/delivery-date`;

  const set = await asAdmin("PATCH", path, { estimatedDeliveryDate: "2030-01-15" });
  assert.equal(set.status, 200);
  assert.equal(set.body.data.order.estimatedDeliveryDate, "2030-01-15T00:00:00.000Z");
  assert.equal(
    set.body.data.order.statusHistory.at(-1).note,
    "Estimated delivery date: 2030-01-15"
  );

  const cleared = await asAdmin("PATCH", path, { estimatedDeliveryDate: null });
  assert.equal(cleared.body.data.order.estimatedDeliveryDate, null);

  assert.equal((await asAdmin("PATCH", path, { estimatedDeliveryDate: "soon" })).status, 400);
  await setStatus(order._id, "cancelled");
  assert.equal((await asAdmin("PATCH", path, { estimatedDeliveryDate: null })).status, 409);
});

test("only a delivered order can be marked paid, and only once", async () => {
  const { order } = await placeOne();
  const path = `/admin/orders/${order._id}/payment`;
  const paid = { paymentStatus: "paid" };

  assert.equal((await asAdmin("PATCH", path, paid)).status, 409);
  assert.equal((await asAdmin("PATCH", path, { paymentStatus: "refunded" })).status, 400);

  await advanceTo(order._id, "confirmed", "packed", "out_for_delivery", "delivered");
  const res = await asAdmin("PATCH", path, paid);
  assert.equal(res.status, 200);
  assert.equal(res.body.data.order.paymentStatus, "paid");
  assert.equal(res.body.data.order.statusHistory.at(-1).note, "Cash collected");
  assert.equal((await asAdmin("PATCH", path, paid)).status, 409);
});

test("the admin list filters by status and date, and finds number or phone", async () => {
  const cookie = await register("search@example.com");
  const product = await makeProduct({ stock: 50 });
  const res = await api("POST", "/orders", {
    body: {
      items: [{ productId: String(product._id), qty: 1 }],
      delivery: { ...delivery, phone: "99 88 77 66" },
    },
    cookie,
  });
  const { order } = res.body.data;
  await setStatus(order._id, "confirmed");

  const ids = async (query: string) => {
    const list = await asAdmin("GET", `/admin/orders?limit=50&${query}`);
    assert.equal(list.status, 200, query);
    return list.body.data.items.map((o: { _id: string }) => o._id);
  };
  assert.deepEqual(await ids(`q=${order.orderNumber.toLowerCase()}`), [order._id]);
  assert.deepEqual(await ids(`q=${encodeURIComponent("+356 9988 7766")}`), [order._id]);
  assert.deepEqual(await ids("q=99887766&status=pending"), []);
  assert.ok((await ids("status=confirmed")).includes(order._id));
  assert.ok(!(await ids("status=pending")).includes(order._id));

  const encoded = (date: string) => encodeURIComponent(date);
  assert.ok((await ids(`from=${encoded("2020-01-01T00:00:00+01:00")}`)).includes(order._id));
  assert.deepEqual(await ids(`to=${encoded("2020-01-01T00:00:00Z")}`), []);

  const list = await asAdmin("GET", "/admin/orders?q=99887766");
  assert.equal(list.body.data.items[0].delivery.name, "Sita");
  const detail = await asAdmin("GET", `/admin/orders/${order._id}`);
  assert.equal(detail.body.data.order.user.email, "search@example.com");
  assert.equal(detail.body.data.order.user.passwordHash, undefined);

  for (const bad of ["status=shipped", "from=yesterday", "delivery.phone[$ne]=1"]) {
    assert.equal((await asAdmin("GET", `/admin/orders?${bad}`)).status, 400, bad);
  }
  assert.equal((await asAdmin("GET", "/admin/orders/507f1f77bcf86cd799439011")).status, 404);
});

test("order lists use an index for both the filter and the sort", async () => {
  const sort = { createdAt: -1, _id: -1 } as const;
  const queries = [
    OrderModel.find({ user: new mongoose.Types.ObjectId() }).sort(sort),
    OrderModel.find({}).sort(sort),
    OrderModel.find({ status: "pending" }).sort(sort),
    OrderModel.find({ "delivery.phone": "79123456" }).sort(sort),
    OrderModel.find({ createdAt: { $gte: new Date(0) } }).sort(sort),
  ];
  for (const query of queries) {
    const { queryPlanner } = (await query.explain("queryPlanner")) as unknown as {
      queryPlanner: { winningPlan: unknown };
    };
    const plan = JSON.stringify(queryPlanner.winningPlan);
    assert.match(plan, /IXSCAN/);
    assert.doesNotMatch(plan, /COLLSCAN/);
    assert.doesNotMatch(plan, /"stage":"SORT"/);
  }
});

test("placing orders is rate limited, but rejected attempts don't count", async () => {
  const ip = "10.250.0.1";
  const product = await makeProduct({ stock: 20 });
  const small = await makeProduct({ price: 100 });
  const order = () => place([{ productId: product._id, qty: 1 }], customerCookie, ip);

  assert.equal((await place([{ productId: small._id, qty: 1 }], customerCookie, ip)).status, 400);
  for (let i = 0; i < 10; i++) assert.equal((await order()).status, 201, `order ${i + 1}`);
  const blocked = await order();
  assert.equal(blocked.status, 429);
  assert.equal(await stockOf(product._id), 10);
});
