import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import net from "node:net";
import type { AddressInfo } from "node:net";
import { after, before, test } from "node:test";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";

let mongo: MongoMemoryServer;

const freePort = async () => {
  const server = net.createServer().listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  const { port } = server.address() as AddressInfo;
  await new Promise((resolve) => server.close(resolve));
  return port;
};

// Starts the real server.ts in its own process. Resolves when it stops or starts listening.
const startServer = async (database: string) => {
  const port = await freePort();
  const child = spawn(process.execPath, ["--import", "tsx", "src/server.ts"], {
    env: {
      ...process.env,
      MONGODB_URI: mongo.getUri(database),
      JWT_SECRET: "test-secret-".repeat(4),
      NODE_ENV: "test",
      LOG_LEVEL: "info",
      PORT: String(port),
      SMTP_HOST: "",
    },
  });

  let output = "";
  child.stdout.on("data", (chunk) => (output += chunk));
  child.stderr.on("data", (chunk) => (output += chunk));

  const outcome = await new Promise<{ exitCode: number | null; listening: boolean }>((resolve) => {
    child.once("exit", (exitCode) => resolve({ exitCode, listening: false }));
    child.stdout.on("data", () => {
      if (output.includes("Server listening")) resolve({ exitCode: null, listening: true });
    });
  });
  return { ...outcome, output, port, stop: () => child.kill() };
};

before(async () => {
  mongo = await MongoMemoryServer.create();
});
after(async () => {
  await mongo.stop();
});

test("the server won't start when a unique index can't be built", async () => {
  const connection = await mongoose.createConnection(mongo.getUri("duplicates")).asPromise();
  await connection.db?.collection("users").insertMany([
    { email: "same@shop.test", username: "One", role: "customer" },
    { email: "same@shop.test", username: "Two", role: "customer" },
  ]);
  await connection.close();

  const { exitCode, listening, output } = await startServer("duplicates");
  assert.equal(listening, false);
  assert.equal(exitCode, 1);
  assert.match(output, /Could not build database indexes/);
  assert.doesNotMatch(output, /mongodb:\/\/[^*]/, "the log doesn't show the connection string");
});

test("the server starts normally on a clean database, with indexes ready", async () => {
  const server = await startServer("clean");
  try {
    assert.equal(server.listening, true, server.output);
    const res = await fetch(`http://127.0.0.1:${server.port}/api/v1/health`);
    assert.equal(res.status, 200);

    const connection = await mongoose.createConnection(mongo.getUri("clean")).asPromise();
    const indexes = await connection.db?.collection("users").indexes();
    await connection.close();
    assert.ok(indexes?.some((index) => index.name === "email_1" && index.unique));
  } finally {
    server.stop();
  }
});

test("a mail server that never answers fails quickly instead of hanging", async () => {
  const sockets = new Set<net.Socket>();
  const silent = net.createServer((socket) => {
    sockets.add(socket);
    socket.on("error", () => {});
  });
  silent.listen(0);
  await new Promise((resolve) => silent.once("listening", resolve));

  process.env.MONGODB_URI = "mongodb://127.0.0.1:1/unused";
  process.env.JWT_SECRET = "test-secret-".repeat(4);
  process.env.NODE_ENV = "test";
  process.env.LOG_LEVEL = "fatal";
  process.env.SMTP_HOST = "127.0.0.1";
  process.env.SMTP_PORT = String((silent.address() as AddressInfo).port);
  const { mailer } = await import("../src/utils/mailer.js");

  const started = Date.now();
  try {
    await assert.rejects(mailer.send({ to: "a@shop.test", subject: "Hi", text: "Hello" }));
    const seconds = (Date.now() - started) / 1000;
    assert.ok(seconds < 15, `took ${seconds} seconds`);
  } finally {
    for (const socket of sockets) socket.destroy();
    silent.close();
  }
});
