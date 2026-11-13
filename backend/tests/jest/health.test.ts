import { afterAll, beforeAll, describe, expect, it, jest } from "@jest/globals";
import mongoose from "mongoose";
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

describe("GET /api/v1/health/ready without a database", () => {
  it("returns a 503 so the load balancer stops sending traffic", async () => {
    const res = await request(app).get("/api/v1/health/ready");

    expect(res.status).toBe(503);
    expect(res.body).toEqual({
      success: false,
      error: { code: "DATABASE_UNAVAILABLE", message: "Database is not reachable" },
    });
  });
});

describe("GET /api/v1/health/ready with a database", () => {
  beforeAll(startTestDb);
  afterAll(stopTestDb);

  it("returns a 200 when the database answers a ping", async () => {
    const res = await request(app).get("/api/v1/health/ready");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, data: { status: "ready" } });
  });

  it("returns a 503 when the ping fails", async () => {
    const db = mongoose.connection.db!;
    const ping = jest.spyOn(db, "command").mockRejectedValueOnce(new Error("connection reset"));
    try {
      const res = await request(app).get("/api/v1/health/ready");
      expect(res.status).toBe(503);
      expect(res.body.error.code).toBe("DATABASE_UNAVAILABLE");
    } finally {
      ping.mockRestore();
    }
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
