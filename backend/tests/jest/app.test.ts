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
