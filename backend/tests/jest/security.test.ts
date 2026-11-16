import { afterAll, beforeAll, describe, expect, it } from "@jest/globals";
import request from "supertest";
import { app } from "../../src/app.js";
import { UserModel } from "../../src/modules/users/user.model.js";
import { startTestDb, stopTestDb } from "./helpers/test-db.js";

const PASSWORD = "correct-horse-battery";

beforeAll(startTestDb);
afterAll(stopTestDb);

describe("mass assignment", () => {
  it("ignores a role sent at registration, so nobody can sign up as admin", async () => {
    const res = await request(app).post("/api/v1/auth/register").send({
      username: "Mallory",
      email: "mallory@example.com",
      password: PASSWORD,
      role: "admin",
    });

    expect(res.status).toBe(201);
    expect(res.body.data.user.role).toBe("customer");
    const saved = await UserModel.findOne({ email: "mallory@example.com" }).lean();
    expect(saved?.role).toBe("customer");
  });
});

describe("NoSQL injection in JSON bodies", () => {
  it("rejects operator objects where a string is expected", async () => {
    const attempts = [
      ["/api/v1/auth/login", { email: { $ne: null }, password: { $ne: null } }],
      ["/api/v1/auth/login", { email: "mallory@example.com", password: { $gt: "" } }],
      ["/api/v1/auth/forgot-password", { email: { $gt: "" } }],
      ["/api/v1/auth/reset-password", { token: { $ne: null }, password: PASSWORD }],
    ] as const;

    for (const [path, body] of attempts) {
      const res = await request(app).post(path).send(body);
      expect({ path, status: res.status, code: res.body.error?.code }).toEqual({
        path,
        status: 400,
        code: "VALIDATION_ERROR",
      });
    }
  });
});
