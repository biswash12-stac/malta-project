import { describe, expect, it, jest } from "@jest/globals";
import request from "supertest";
import { app } from "../../src/app.js";

describe("S-01: API responses are never cached", () => {
  it("sends Cache-Control: no-store on success, error and not-found responses", async () => {
    const responses = [
      await request(app).get("/api/v1/health"),
      await request(app).get("/api/v1/auth/me"), // 401, no database needed
      await request(app).get("/api/v1/no-such-route"),
      await request(app)
        .post("/api/v1/auth/login")
        .set("Content-Type", "application/json")
        .send("{ broken"),
    ];
    for (const res of responses) {
      expect({ path: res.req.path, cache: res.headers["cache-control"] }).toEqual({
        path: res.req.path,
        cache: "no-store",
      });
    }
  });
});

describe("S-05: logs never contain query strings", () => {
  it("the request log records the path only", async () => {
    const { requestLogSerializers } = await import("../../src/utils/request-log.js");
    const logged = requestLogSerializers.req({
      method: "GET",
      url: "/api/v1/admin/orders?q=79123456&status=pending",
    } as never);
    expect(logged).toEqual({ method: "GET", path: "/api/v1/admin/orders" });
    expect(JSON.stringify(logged)).not.toContain("79123456");
  });

  it("the error handler logs the path without the query string", async () => {
    const { errorHandler } = await import("../../src/middlewares/error.middleware.js");
    const { logger } = await import("../../src/utils/logger.js");
    const spy = jest.spyOn(logger, "error").mockImplementation(() => undefined as never);
    try {
      const res = { status: () => res, json: () => res } as never;
      errorHandler(
        new Error("boom"),
        { method: "GET", originalUrl: "/api/v1/admin/orders?q=79123456" } as never,
        res,
        (() => undefined) as never
      );
      const line = JSON.stringify(spy.mock.calls);
      expect(line).toContain("/api/v1/admin/orders");
      expect(line).not.toContain("79123456");
    } finally {
      spy.mockRestore();
    }
  });
});

describe("S-04: state-changing requests from another origin are refused", () => {
  // CLIENT_URL is http://shop.test in tests (setup-env.ts).
  const logout = (origin?: string) => {
    const req = request(app).post("/api/v1/auth/logout");
    return origin === undefined ? req : req.set("Origin", origin);
  };

  it("refuses a foreign origin before touching the session", async () => {
    const res = await logout("https://evil.example");
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("FORBIDDEN");
    expect(res.headers["set-cookie"]).toBeUndefined();
  });

  it("allows the frontend's own origin", async () => {
    expect((await logout("http://shop.test")).status).toBe(200);
  });

  it("allows requests with no Origin (curl, server-side calls): browsers always send one", async () => {
    expect((await logout()).status).toBe(200);
  });

  it("refuses Origin: null and near-miss origins", async () => {
    for (const origin of [
      "null",
      "https://shop.test",
      "http://shop.test:3001",
      "http://shop.test.evil.example",
    ]) {
      expect({ origin, status: (await logout(origin)).status }).toEqual({ origin, status: 403 });
    }
  });

  it("checks PATCH and DELETE too, before authentication", async () => {
    const id = "507f1f77bcf86cd799439011";
    const patch = await request(app)
      .patch(`/api/v1/categories/${id}`)
      .set("Origin", "https://evil.example")
      .send({ name: "x" });
    const del = await request(app)
      .delete(`/api/v1/products/${id}`)
      .set("Origin", "https://evil.example");
    expect([patch.status, del.status]).toEqual([403, 403]);
  });

  it("never blocks reads", async () => {
    const res = await request(app).get("/api/v1/health").set("Origin", "https://evil.example");
    expect(res.status).toBe(200);
  });
});
