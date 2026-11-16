import { describe, expect, it } from "@jest/globals";
import request from "supertest";
import { app } from "../../src/app.js";

describe("every response", () => {
  it("carries the API version, including errors", async () => {
    for (const path of ["/api/v1/health", "/api/v1/no-such-route"]) {
      const res = await request(app).get(path);
      expect(res.headers["x-api-version"]).toBe("1.0.0");
    }
  });
});

describe("CORS", () => {
  // CLIENT_URL is http://shop.test in tests (setup-env.ts) and http://localhost:3000 in .env.
  const preflight = (origin: string, headers: string) =>
    request(app)
      .options("/api/v1/orders")
      .set("Origin", origin)
      .set("Access-Control-Request-Method", "POST")
      .set("Access-Control-Request-Headers", headers);

  it("lets the frontend send cookies and the three allowed headers", async () => {
    const res = await preflight("http://shop.test", "content-type,authorization,idempotency-key");

    expect(res.status).toBe(204);
    expect(res.headers["access-control-allow-origin"]).toBe("http://shop.test");
    expect(res.headers["access-control-allow-credentials"]).toBe("true");
    expect(res.headers["access-control-allow-headers"]).toBe(
      "Content-Type,Authorization,Idempotency-Key"
    );
  });

  it("doesn't allow other headers just because the browser asks for them", async () => {
    const res = await preflight("http://shop.test", "x-anything");
    expect(res.headers["access-control-allow-headers"]).not.toContain("x-anything");
  });

  it("never names another site as allowed, so the browser blocks it", async () => {
    const res = await preflight("http://evil.test", "content-type");
    expect(res.headers["access-control-allow-origin"]).toBe("http://shop.test");
  });
});

describe("malformed JSON", () => {
  it("returns a 400 with the standard error envelope", async () => {
    const res = await request(app)
      .post("/api/v1/auth/login")
      .set("Content-Type", "application/json")
      .send('{ "name": "test"');

    expect(res.status).toBe(400);
    expect(res.headers["x-api-version"]).toBe("1.0.0");
    expect(res.body).toEqual({
      success: false,
      error: { code: "BAD_REQUEST", message: "Invalid request" },
    });
  });
});
