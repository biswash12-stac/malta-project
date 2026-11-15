// Frontend tampering cannot bypass the backend. Every attack here is made directly against the API,
// as an attacker with DevTools, Postman or curl would. The browser (localStorage, React state,
// hidden buttons, route guards) is assumed fully attacker-controlled.
// Checkout math with real stock needs MongoDB transactions, so those cases live in
// tests/orders.test.ts ("the client can't send prices, a delivery fee or a total", oversell,
// idempotency, status path, payment rules).
import { afterAll, beforeAll, describe, expect, it } from "@jest/globals";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import request from "supertest";
import { app } from "../../src/app.js";
import { OrderModel } from "../../src/modules/orders/order.model.js";
import { UserModel } from "../../src/modules/users/user.model.js";
import { startTestDb, stopTestDb } from "./helpers/test-db.js";

const PASSWORD = "correct-horse-battery";
const JWT_SHAPE = /eyJ[\w-]+\.[\w-]+\.[\w-]+/;
const OTHER_ID = "507f1f77bcf86cd799439011";

const signUp = async (email: string, extra: Record<string, unknown> = {}) => {
  const agent = request.agent(app);
  const res = await agent
    .post("/api/v1/auth/register")
    .send({ username: "Tester", email, password: PASSWORD, ...extra });
  expect(res.status).toBe(201);
  return { agent, res };
};

let alice: request.Agent;
let bob: request.Agent;
let bobOrderId: string;

const orderFor = (userId: unknown) =>
  OrderModel.create({
    orderNumber: `NG-20300101-${Math.floor(Math.random() * 9000 + 1000)}`,
    user: userId,
    items: [
      {
        productId: new mongoose.Types.ObjectId(),
        nameSnapshot: "Rice",
        unitSnapshot: "1 kg",
        priceSnapshot: 2500,
        qty: 1,
      },
    ],
    subtotal: 2500,
    deliveryFee: 500,
    total: 3000,
    delivery: { name: "Bob", phone: "79123456", address: "1 Triq", locality: "Sliema" },
    statusHistory: [{ status: "pending", at: new Date(), by: userId }],
  });

beforeAll(async () => {
  await startTestDb();
  alice = (await signUp("alice@example.com")).agent;
  bob = (await signUp("bob@example.com")).agent;
  const bobUser = await UserModel.findOne({ email: "bob@example.com" }).lean();
  bobOrderId = String((await orderFor(bobUser?._id))._id);
});
afterAll(stopTestDb);

const adminRoutes: [method: "get" | "post" | "patch" | "delete", path: string, body?: object][] = [
  ["get", "/api/v1/admin/stats"],
  ["get", "/api/v1/admin/orders"],
  ["get", `/api/v1/admin/orders/${OTHER_ID}`],
  ["patch", `/api/v1/admin/orders/${OTHER_ID}/status`, { status: "delivered" }],
  ["patch", `/api/v1/admin/orders/${OTHER_ID}/payment`, { paymentStatus: "paid" }],
  ["patch", `/api/v1/admin/orders/${OTHER_ID}/delivery-date`, { estimatedDeliveryDate: null }],
  ["get", "/api/v1/admin/products"],
  ["get", `/api/v1/admin/products/${OTHER_ID}`],
  [
    "post",
    "/api/v1/products",
    { nameEn: "Hack", nameNp: "ह्याक", price: 1, unit: "1", stock: 1, category: OTHER_ID },
  ],
  ["patch", `/api/v1/products/${OTHER_ID}`, { price: 1 }],
  ["delete", `/api/v1/products/${OTHER_ID}`],
  ["get", "/api/v1/admin/categories"],
  ["post", "/api/v1/categories", { name: "Hack" }],
  ["patch", `/api/v1/categories/${OTHER_ID}`, { isActive: false }],
  ["delete", `/api/v1/categories/${OTHER_ID}`],
  ["post", "/api/v1/admin/uploads/signature"],
];

const call = (
  client: request.Agent | ReturnType<typeof request>,
  [method, path, body]: (typeof adminRoutes)[number]
) => {
  const req = (client as request.Agent)[method](path);
  return body ? req.send(body) : req;
};

describe("privilege escalation", () => {
  it("a role sent at registration is ignored; the account stays a customer", async () => {
    const { agent, res } = await signUp("mallory@example.com", { role: "admin", isAdmin: true });
    expect(res.body.data.user.role).toBe("customer");
    expect((await agent.get("/api/v1/admin/stats")).status).toBe(403);
  });

  it("a customer gets 403 on every admin action, whatever the browser claims", async () => {
    for (const route of adminRoutes) {
      // Cookies and headers a tampered frontend might add. The API reads none of them.
      const res = await call(alice, route)
        .set("X-Role", "admin")
        .set("Cookie", 'malta-user={"role":"admin"}'); // merged with the real session cookie
      expect({ route: route.slice(0, 2), status: res.status }).toEqual({
        route: route.slice(0, 2),
        status: 403,
      });
    }
  });

  it("without a login, every protected route answers 401", async () => {
    const anonymous = request(app);
    const protectedRoutes = [
      ...adminRoutes,
      ["get", "/api/v1/auth/me"],
      ["get", "/api/v1/orders/mine"],
      ["get", `/api/v1/orders/${OTHER_ID}`],
    ] as typeof adminRoutes;
    for (const route of protectedRoutes) {
      const res = await call(anonymous as never, route);
      expect({ route: route.slice(0, 2), status: res.status }).toEqual({
        route: route.slice(0, 2),
        status: 401,
      });
    }
  });
});

describe("forged and tampered tokens", () => {
  it("a token signed with another secret is rejected, even for a real user id", async () => {
    const bobUser = await UserModel.findOne({ email: "bob@example.com" }).lean();
    const forged = jwt.sign({ use: "access", ver: 0 }, "attacker-secret-".repeat(3), {
      subject: String(bobUser?._id),
      expiresIn: 600,
    });
    const res = await request(app)
      .get("/api/v1/auth/me")
      .set("Cookie", [`access_token=${forged}`]);
    expect(res.status).toBe(401);
  });

  it("an edited token is rejected", async () => {
    const login = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: "alice@example.com", password: PASSWORD });
    const cookie = ([] as string[]).concat(login.headers["set-cookie"] ?? []);
    const token =
      cookie
        .find((c) => c.startsWith("access_token="))
        ?.split(";")[0]
        ?.split("=")[1] ?? "";
    const [header, , signature] = token.split(".");
    const payload = Buffer.from(JSON.stringify({ sub: OTHER_ID, use: "access", ver: 0 })).toString(
      "base64url"
    );
    const res = await request(app)
      .get("/api/v1/auth/me")
      .set("Cookie", [`access_token=${header}.${payload}.${signature}`]);
    expect(res.status).toBe(401);
  });
});

describe("other customers' data", () => {
  it("customer A cannot read customer B's order; B can", async () => {
    expect((await alice.get(`/api/v1/orders/${bobOrderId}`)).status).toBe(404);
    expect((await bob.get(`/api/v1/orders/${bobOrderId}`)).status).toBe(200);
  });

  it("customer A's order list never includes B's orders", async () => {
    const res = await alice.get("/api/v1/orders/mine");
    expect(res.status).toBe(200);
    expect(res.body.data.items.map((o: { _id: string }) => o._id)).not.toContain(bobOrderId);
  });

  it("a customer cannot change an order's status, payment or delivery date", async () => {
    for (const [path, body] of [
      ["status", { status: "delivered" }],
      ["payment", { paymentStatus: "paid" }],
      ["delivery-date", { estimatedDeliveryDate: "2030-01-02" }],
    ] as const) {
      expect(
        (await bob.patch(`/api/v1/admin/orders/${bobOrderId}/${path}`).send(body)).status
      ).toBe(403);
    }
    const order = await OrderModel.findById(bobOrderId).lean();
    expect([order?.status, order?.paymentStatus, order?.estimatedDeliveryDate]).toEqual([
      "pending",
      "pending",
      null,
    ]);
  });
});

describe("checkout values come from the server", () => {
  it("a checkout carrying a user id, prices, a fee or a total is refused before any work", async () => {
    const items = [{ productId: OTHER_ID, qty: 1 }];
    const delivery = { name: "Alice", phone: "79123456", address: "2 Triq", locality: "Gzira" };
    for (const extra of [
      { user: OTHER_ID },
      { total: 1 },
      { subtotal: 1 },
      { deliveryFee: 0 },
      { paymentStatus: "paid" },
      { status: "delivered" },
    ]) {
      const res = await alice.post("/api/v1/orders").send({ items, delivery, ...extra });
      expect({ extra, status: res.status, code: res.body.error?.code }).toEqual({
        extra,
        status: 400,
        code: "VALIDATION_ERROR",
      });
    }
    const priced = await alice
      .post("/api/v1/orders")
      .send({ items: [{ productId: OTHER_ID, qty: 1, price: 1 }], delivery });
    expect(priced.status).toBe(400);
  });
});

describe("no token ever reaches frontend JavaScript", () => {
  it("auth responses carry tokens only in httpOnly cookies, never in the body", async () => {
    const { res: registered } = await signUp("cookie-check@example.com");
    const login = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: "cookie-check@example.com", password: PASSWORD });
    const cookies = ([] as string[]).concat(login.headers["set-cookie"] ?? []);
    const agent = request.agent(app);
    await agent
      .post("/api/v1/auth/login")
      .send({ email: "cookie-check@example.com", password: PASSWORD });
    const me = await agent.get("/api/v1/auth/me");

    for (const res of [registered, login, me]) {
      expect(JSON.stringify(res.body)).not.toMatch(JWT_SHAPE);
      expect(JSON.stringify(res.body)).not.toMatch(/"[a-z]*token"\s*:/i); // no token-like key
    }
    for (const name of ["access_token", "refresh_token"]) {
      const cookie = cookies.find((c) => c.startsWith(`${name}=`)) ?? "";
      expect({ name, httpOnly: /; HttpOnly/i.test(cookie) }).toEqual({ name, httpOnly: true });
    }
    expect(me.headers["cache-control"]).toBe("no-store");
  });
});
