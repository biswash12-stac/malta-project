// Loads the app in production mode, which setup-env.ts doesn't, so this file imports it later.
import { afterAll, beforeAll, describe, expect, it } from "@jest/globals";
import type { Express } from "express";
import request from "supertest";
import { startTestDb, stopTestDb } from "./helpers/test-db.js";

let app: Express;

beforeAll(async () => {
  // Placeholder values for everything production requires. None of them is contacted here.
  Object.assign(process.env, {
    NODE_ENV: "production",
    TWO_FACTOR_SECRET: "jest-two-factor-".repeat(3),
    SMTP_HOST: "smtp.invalid",
    SMTP_USER: "jest",
    SMTP_PASS: "jest",
    MAIL_FROM: "no-reply@shop.test",
    GOOGLE_CLIENT_ID: "jest-client-id",
    CLOUDINARY_CLOUD_NAME: "jest",
    CLOUDINARY_API_KEY: "jest",
    CLOUDINARY_API_SECRET: "jest",
  });
  ({ app } = await import("../../src/app.js"));
  await startTestDb();
});
afterAll(stopTestDb);

describe("cookies in production", () => {
  it("are Secure and httpOnly, with the strict refresh cookie limited to auth routes", async () => {
    const res = await request(app).post("/api/v1/auth/register").send({
      username: "Prod",
      email: "prod@example.com",
      password: "correct-horse-battery",
    });
    expect(res.status).toBe(201);

    const cookies = ([] as string[]).concat(res.headers["set-cookie"] ?? []);
    const find = (name: string) => cookies.find((cookie) => cookie.startsWith(`${name}=`)) ?? "";

    const access = find("access_token");
    expect(access).toMatch(/; Secure/);
    expect(access).toMatch(/; HttpOnly/);
    expect(access).toMatch(/; SameSite=Lax/);

    const refresh = find("refresh_token");
    expect(refresh).toMatch(/; Secure/);
    expect(refresh).toMatch(/; HttpOnly/);
    expect(refresh).toMatch(/; SameSite=Strict/);
    expect(refresh).toMatch(/; Path=\/api\/v1\/auth/);
  });
});
