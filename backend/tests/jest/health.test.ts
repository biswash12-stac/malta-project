import { afterAll, beforeAll, describe, expect, it } from "@jest/globals";
import request from "supertest";
import { app } from "../../src/app.js";
import { startTestDb, stopTestDb } from "./helpers/test-db.js";

describe("GET /api/v1/health", () => {
  it("reports that the API is up", async () => {
    const res = await request(app).get("/api/v1/health");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      success: true,
      data: { status: "ok", uptime: expect.any(Number) },
    });
  });
});

describe("GET /api/v1/categories", () => {
  beforeAll(startTestDb);
  afterAll(stopTestDb);

  it("returns an empty first page from the test database", async () => {
    const res = await request(app).get("/api/v1/categories");

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({
      items: [],
      pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
    });
  });
});
