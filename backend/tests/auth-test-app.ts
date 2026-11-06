// Shared setup for the auth tests: the real app on a temporary database, with emails captured.
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { mock } from "node:test";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";

export const PASSWORD = "correct-horse-battery";

export type Mail = { to: string; subject: string; text: string };

let nextIp = 1;

export const startAuthApp = async () => {
  const mongo = await MongoMemoryServer.create();
  // Set before the app loads, so tests can never touch the database or email account in .env.
  process.env.MONGODB_URI = mongo.getUri("test");
  process.env.JWT_SECRET = "test-secret-".repeat(4);
  process.env.NODE_ENV = "test";
  process.env.LOG_LEVEL = "fatal";
  process.env.SMTP_HOST = "";
  process.env.CLIENT_URL = "http://shop.test";
  process.env.GOOGLE_CLIENT_ID = "test-client-id";
  // One proxy, so each test client below can have its own IP and its own rate limits.
  process.env.TRUST_PROXY_HOPS = "1";

  const { app } = await import("../src/app.js");
  const { connectDB } = await import("../src/config/db.js");
  const { mailer } = await import("../src/utils/mailer.js");
  const { UserModel } = await import("../src/modules/users/user.model.js");
  const { RefreshSessionModel } = await import("../src/modules/auth/refresh-session.model.js");
  await connectDB();
  await Promise.all([UserModel.init(), RefreshSessionModel.init()]);

  const mails: Mail[] = [];
  const sendMock = mock.method(mailer, "send", async (mail: Mail) => {
    mails.push(mail);
  });

  const server: Server = await new Promise((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/v1`;

  // A browser stand-in: it keeps cookies between requests and has its own IP address.
  class Client {
    jar = new Map<string, string>();
    ip = `10.${(nextIp >> 8) & 255}.${nextIp++ & 255}.1`;

    async request(method: string, path: string, body?: unknown) {
      const res = await fetch(base + path, {
        method,
        headers: {
          "x-forwarded-for": this.ip,
          ...(body !== undefined && { "content-type": "application/json" }),
          ...(this.jar.size > 0 && {
            cookie: [...this.jar].map(([name, value]) => `${name}=${value}`).join("; "),
          }),
        },
        ...(body !== undefined && { body: JSON.stringify(body) }),
      });
      const setCookies = res.headers.getSetCookie();
      for (const cookie of setCookies) {
        const pair = cookie.split(";")[0] ?? "";
        const name = pair.slice(0, pair.indexOf("="));
        const value = pair.slice(pair.indexOf("=") + 1);
        if (value) this.jar.set(name, value);
        else this.jar.delete(name);
      }
      const raw = await res.text();
      return { status: res.status, raw, body: JSON.parse(raw), setCookies };
    }
    post = (path: string, body?: unknown) => this.request("POST", path, body);
    get = (path: string) => this.request("GET", path);
    register = (email: string, password = PASSWORD) =>
      this.post("/auth/register", { username: "Test", email, password });
    login = (email: string, password = PASSWORD) => this.post("/auth/login", { email, password });
  }

  // Background emails finish after the response, so wait for them.
  const waitForMail = async (to: string, count = 1) => {
    for (let i = 0; i < 200; i++) {
      const found = mails.filter((m) => m.to === to);
      if (found.length >= count) return found[count - 1] as Mail;
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    throw new Error(`No email number ${count} reached ${to}`);
  };

  const stop = async () => {
    sendMock.mock.restore();
    server.close();
    await mongoose.disconnect();
    await mongo.stop();
  };

  return { Client, mails, waitForMail, sendMock, UserModel, RefreshSessionModel, stop };
};

export const codeIn = (mail: Mail) => /\b(\d{6})\b/.exec(mail.text)?.[1] ?? "";
export const wrongCode = (code: string) => (code === "000000" ? "000001" : "000000");
