import assert from "node:assert/strict";
import { after, before, beforeEach, mock, test } from "node:test";
import mongoose from "mongoose";
import { startAuthApp } from "./auth-test-app.js";

const CLOUD = "test-cloud";
const HOUR = 60 * 60 * 1000;
const now = new Date("2030-06-01T12:00:00Z");

let t: Awaited<ReturnType<typeof startAuthApp>>;
let runUploadCleanup: typeof import("../src/modules/uploads/upload-cleanup.js").runUploadCleanup;
let cloudinary: typeof import("../src/modules/uploads/upload.service.js").cloudinary;
let UploadTicketModel: typeof import("../src/modules/uploads/upload-ticket.model.js").UploadTicketModel;
let ProductModel: typeof import("../src/modules/products/product.model.js").ProductModel;
let destroyed: string[] = [];
let failNext = new Set<string>();
let onDestroy: ((publicId: string) => Promise<void>) | undefined;
let destroyMock: { mock: { restore: () => void } };
let adminId: mongoose.Types.ObjectId;
let categoryId: mongoose.Types.ObjectId;

const ticket = (publicId: string, hoursOld: number) =>
  UploadTicketModel.create({
    publicId,
    createdBy: adminId,
    createdAt: new Date(now.getTime() - hoursOld * HOUR),
  });
const ticketsLeft = async () =>
  (await UploadTicketModel.find().sort({ publicId: 1 }).lean()).map((t) => t.publicId);

before(async () => {
  process.env.CLOUDINARY_CLOUD_NAME = CLOUD;
  process.env.CLOUDINARY_API_KEY = "test-api-key";
  process.env.CLOUDINARY_API_SECRET = "test-api-secret";
  t = await startAuthApp();
  ({ runUploadCleanup } = await import("../src/modules/uploads/upload-cleanup.js"));
  ({ cloudinary } = await import("../src/modules/uploads/upload.service.js"));
  ({ UploadTicketModel } = await import("../src/modules/uploads/upload-ticket.model.js"));
  ({ ProductModel } = await import("../src/modules/products/product.model.js"));
  const { CategoryModel } = await import("../src/modules/categories/category.model.js");
  destroyMock = mock.method(cloudinary, "destroy", async (publicId: string) => {
    if (onDestroy) await onDestroy(publicId);
    if (failNext.delete(publicId)) throw new Error("Cloudinary answered 500");
    destroyed.push(publicId);
  }) as never;
  adminId = new mongoose.Types.ObjectId();
  categoryId = (await CategoryModel.create({ name: "Fruits", slug: "fruits" }))._id;
});
beforeEach(async () => {
  destroyed = [];
  failNext = new Set();
  onDestroy = undefined;
  await UploadTicketModel.deleteMany({});
  await mongoose.connection.collection("joblocks").deleteMany({});
});
after(async () => {
  destroyMock.mock.restore();
  await t.stop();
});

test("uploads abandoned for over 24 hours are deleted; newer ones are kept", async () => {
  await ticket("products/abandoned", 25);
  await ticket("products/still-editing", 23);

  const result = await runUploadCleanup({ now });

  assert.deepEqual(destroyed, ["products/abandoned"]);
  assert.deepEqual(await ticketsLeft(), ["products/still-editing"]);
  assert.deepEqual(result, { status: "ok", checked: 1, deleted: 1, inUse: 0, failed: 0 });
});

test("an old ticket whose image a product uses is never deleted", async () => {
  await ProductModel.create({
    nameEn: "Mangoes",
    nameNp: "आँप",
    slug: "mangoes",
    price: 400,
    unit: "1 kg",
    stock: 3,
    category: categoryId,
    images: [
      {
        url: `https://res.cloudinary.com/${CLOUD}/image/upload/products/in-use.jpg`,
        publicId: "products/in-use",
      },
    ],
  });
  await ticket("products/in-use", 48);

  const result = await runUploadCleanup({ now });

  assert.deepEqual(destroyed, []);
  assert.deepEqual(await ticketsLeft(), [], "the ticket is settled: the product owns the file");
  assert.equal(result.inUse, 1);
  assert.equal(result.deleted, 0);
});

test("running the cleanup again changes nothing", async () => {
  await ticket("products/once", 30);
  await runUploadCleanup({ now });
  const second = await runUploadCleanup({ now });

  assert.deepEqual(destroyed, ["products/once"]);
  assert.deepEqual(second, { status: "ok", checked: 0, deleted: 0, inUse: 0, failed: 0 });
});

test("a failed delete keeps its ticket, reports partial, and is retried next time", async () => {
  await ticket("products/flaky", 30);
  await ticket("products/fine", 30);
  failNext.add("products/flaky");

  const first = await runUploadCleanup({ now });
  assert.equal(first.status, "partial");
  assert.equal(first.failed, 1);
  assert.equal(first.deleted, 1);
  assert.deepEqual(await ticketsLeft(), ["products/flaky"]);

  const retry = await runUploadCleanup({ now: new Date(now.getTime() + HOUR) });
  assert.equal(retry.status, "ok");
  assert.deepEqual(await ticketsLeft(), []);
  assert.deepEqual(destroyed.sort(), ["products/fine", "products/flaky"]);
});

test("two cleanups at the same time: only one does the work", async () => {
  await ticket("products/race-a", 30);
  await ticket("products/race-b", 30);

  const results = await Promise.all([runUploadCleanup({ now }), runUploadCleanup({ now })]);

  assert.deepEqual(results.map((r) => r.status).sort(), ["ok", "skipped-locked"]);
  assert.deepEqual(destroyed.sort(), ["products/race-a", "products/race-b"]);
});

test("a lock left by a crashed run expires and does not block cleanup forever", async () => {
  await mongoose.connection.collection("joblocks").insertOne({
    _id: "upload-cleanup" as never,
    owner: "crashed",
    lockedUntil: new Date(now.getTime() - HOUR),
  });
  await ticket("products/after-crash", 30);

  const result = await runUploadCleanup({ now });

  assert.equal(result.status, "ok");
  assert.deepEqual(destroyed, ["products/after-crash"]);
});

test("only refresh sessions and idempotency keys expire automatically; orders never do", async () => {
  const { OrderModel } = await import("../src/modules/orders/order.model.js");
  await Promise.all([OrderModel.init(), ProductModel.init(), UploadTicketModel.init()]);
  const ttl: string[] = [];
  for (const name of (await mongoose.connection.db!.listCollections().toArray()).map(
    (c) => c.name
  )) {
    const indexes = await mongoose.connection.collection(name).indexes();
    if (indexes.some((index) => index.expireAfterSeconds !== undefined)) ttl.push(name);
  }
  const { IdempotencyKeyModel } = await import("../src/modules/orders/idempotency-key.model.js");
  await IdempotencyKeyModel.init();
  const withIdempotency = (await IdempotencyKeyModel.collection.indexes()).some(
    (index) => index.expireAfterSeconds !== undefined
  );

  assert.deepEqual(
    ttl.filter((name) => name !== "idempotencykeys"),
    ["refreshsessions"]
  );
  assert.ok(withIdempotency);
  assert.ok(!ttl.includes("orders") && !ttl.includes("uploadtickets") && !ttl.includes("products"));
});

test("the schedule runs one minute after start, then hourly, and survives a failing run", async () => {
  const { startUploadCleanupSchedule } = await import("../src/modules/uploads/upload-cleanup.js");
  mock.timers.enable({ apis: ["setTimeout", "setInterval"] });
  let runs = 0;
  const stop = startUploadCleanupSchedule(async () => {
    runs++;
    if (runs === 2) throw new Error("database briefly unavailable");
    return { status: "ok", checked: 0, deleted: 0, inUse: 0, failed: 0 };
  });
  try {
    mock.timers.tick(59_000);
    assert.equal(runs, 0, "not straight away, so startup stays fast");
    mock.timers.tick(1_000);
    await Promise.resolve();
    assert.equal(runs, 1);
    mock.timers.tick(HOUR);
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(runs, 2, "the failing run is caught and logged");
    mock.timers.tick(HOUR);
    await Promise.resolve();
    assert.equal(runs, 3, "and the next hour runs again");
    stop();
    mock.timers.tick(5 * HOUR);
    assert.equal(runs, 3, "stopped schedules never run again");
  } finally {
    mock.timers.reset();
  }
});

test("products have an index on images.publicId, so image lookups never scan the collection", async () => {
  await ProductModel.init();
  const indexes = await ProductModel.collection.indexes();
  assert.ok(indexes.some((index) => Object.keys(index.key).join() === "images.publicId"));
});

const lockDoc = () =>
  mongoose.connection.collection("joblocks").findOne({ _id: "upload-cleanup" as never });

test("R-3: a ticket claimed by a product save is skipped until the claim expires", async () => {
  await ticket("products/being-saved", 30);
  await UploadTicketModel.updateOne(
    { publicId: "products/being-saved" },
    { claimedUntil: new Date(now.getTime() + 10 * 60 * 1000) }
  );
  assert.equal((await runUploadCleanup({ now })).checked, 0);
  assert.deepEqual(destroyed, []);

  const later = new Date(now.getTime() + 11 * 60 * 1000);
  assert.equal(
    (await runUploadCleanup({ now: later })).deleted,
    1,
    "an expired claim is abandoned"
  );
});

test("R-3: interruption: a delete claim left by a crashed worker is taken over once it expires", async () => {
  await ticket("products/crashed-mid-delete", 30);
  await ticket("products/live-worker", 30);
  await UploadTicketModel.updateOne(
    { publicId: "products/crashed-mid-delete" },
    { deletingUntil: new Date(now.getTime() - 60 * 1000) }
  );
  await UploadTicketModel.updateOne(
    { publicId: "products/live-worker" },
    { deletingUntil: new Date(now.getTime() + 5 * 60 * 1000) }
  );

  const result = await runUploadCleanup({ now });

  assert.deepEqual(destroyed, ["products/crashed-mid-delete"]);
  assert.deepEqual(
    await ticketsLeft(),
    ["products/live-worker"],
    "another worker's claim is respected"
  );
  assert.equal(result.deleted, 1);
});

test("R-5: failed deletes back off (1 h, then 2 h) and record the error", async () => {
  await ticket("products/flaky-forever", 30);
  failNext.add("products/flaky-forever");
  await runUploadCleanup({ now });
  let saved = await UploadTicketModel.findOne({ publicId: "products/flaky-forever" }).lean();
  assert.equal(saved?.attempts, 1);
  assert.equal(saved?.nextAttemptAt?.getTime(), now.getTime() + HOUR);
  assert.match(saved?.lastError ?? "", /500/);
  assert.equal(
    saved?.deletingUntil?.getTime(),
    now.getTime() + 10 * 60 * 1000,
    "the claim is kept until it expires (the delete may still land), well before the retry"
  );

  const halfway = await runUploadCleanup({ now: new Date(now.getTime() + 30 * 60 * 1000) });
  assert.equal(halfway.checked, 0, "not retried before it is due");

  failNext.add("products/flaky-forever");
  const due = new Date(now.getTime() + HOUR);
  await runUploadCleanup({ now: due });
  saved = await UploadTicketModel.findOne({ publicId: "products/flaky-forever" }).lean();
  assert.equal(saved?.attempts, 2);
  assert.equal(saved?.nextAttemptAt?.getTime(), due.getTime() + 2 * HOUR);
});

test("R-5: tickets that keep failing never block newer ones", async () => {
  await ticket("products/stuck-1", 50);
  await ticket("products/stuck-2", 49);
  await ticket("products/newer", 30);
  failNext.add("products/stuck-1");
  failNext.add("products/stuck-2");

  const first = await runUploadCleanup({ now, batchSize: 2 });
  assert.equal(first.failed, 2);
  const second = await runUploadCleanup({ now, batchSize: 2 });

  assert.equal(second.deleted, 1);
  assert.deepEqual(destroyed, ["products/newer"]);
});

test("the lock is renewed after every file, so a long run never loses it", async () => {
  // A live clock: tickets old enough in real time.
  for (const name of ["slow-1", "slow-2", "slow-3"]) {
    await UploadTicketModel.create({
      publicId: `products/${name}`,
      createdBy: adminId,
      createdAt: new Date(Date.now() - 30 * HOUR),
    });
  }
  const seen: number[] = [];
  onDestroy = async () => {
    await new Promise((resolve) => setTimeout(resolve, 20));
    seen.push((await lockDoc())?.lockedUntil.getTime() ?? 0);
  };

  const result = await runUploadCleanup();

  assert.equal(result.deleted, 3);
  assert.ok(seen[1]! > seen[0]! && seen[2]! > seen[1]!, `lease extended each time: ${seen}`);
});

test("a run that loses its lock to another worker stops straight away", async () => {
  await ticket("products/lost-1", 32);
  await ticket("products/lost-2", 31);
  await ticket("products/lost-3", 30);
  onDestroy = async () => {
    await mongoose.connection
      .collection("joblocks")
      .updateOne({ _id: "upload-cleanup" as never }, { $set: { owner: "someone-else" } });
  };

  const result = await runUploadCleanup({ now });

  assert.equal(result.status, "lock-lost");
  assert.equal(result.checked, 1);
  assert.deepEqual(await ticketsLeft(), ["products/lost-2", "products/lost-3"]);
});

test("a database error on one ticket is logged and the run carries on with the next", async () => {
  await ticket("products/db-hiccup", 32);
  await ticket("products/next-one", 31);
  let calls = 0;
  const existsMock = mock.method(ProductModel, "exists", (async () => {
    calls++;
    if (calls === 1) throw new Error("connection reset");
    return null; // no product uses the next file
  }) as never);
  try {
    const result = await runUploadCleanup({ now });
    assert.equal(result.status, "partial");
    assert.equal(result.failed, 1);
    assert.equal(result.deleted, 1);
    assert.deepEqual(destroyed, ["products/next-one"]);
    assert.deepEqual(await ticketsLeft(), ["products/db-hiccup"], "kept for a later run");
  } finally {
    existsMock.mock.restore();
  }
});

test("a file deleted from Cloudinary whose ticket then fails to delete is not treated as a Cloudinary failure", async () => {
  await ticket("products/gone-but-ticket-stuck", 30);
  const deleteOneMock = mock.method(UploadTicketModel, "deleteOne", (async () => {
    throw new Error("connection reset");
  }) as never);
  try {
    const result = await runUploadCleanup({ now });
    assert.equal(result.failed, 1);
  } finally {
    deleteOneMock.mock.restore();
  }
  const left = await UploadTicketModel.findOne({
    publicId: "products/gone-but-ticket-stuck",
  }).lean();
  assert.equal(left?.attempts ?? 0, 0, "no Cloudinary back-off for a database error");
  assert.equal(left?.lastError, undefined);
  assert.deepEqual(destroyed, ["products/gone-but-ticket-stuck"]);
  // The claim expires; the next run re-deletes (Cloudinary treats a missing file as success) and finishes.
  const retry = await runUploadCleanup({ now: new Date(now.getTime() + 11 * 60 * 1000) });
  assert.equal(retry.deleted, 1);
  assert.deepEqual(await ticketsLeft(), []);
});

test("a destroy failure on a ticket an edit re-queued mid-run keeps the claim until it expires", async () => {
  await ticket("products/fails-and-requeued", 30);
  const { queueImageRemoval } = await import("../src/modules/uploads/upload.service.js");
  failNext.add("products/fails-and-requeued");
  onDestroy = async () => {
    await queueImageRemoval(["products/fails-and-requeued"], undefined, now);
  };
  try {
    assert.equal((await runUploadCleanup({ now })).failed, 1);
  } finally {
    onDestroy = undefined;
  }
  const left = await UploadTicketModel.findOne({ publicId: "products/fails-and-requeued" }).lean();
  assert.equal(left?.reason, "removed");
  // One queue call means one destroy attempt: a second attempt would queue (and bump rev) again.
  assert.equal(left?.rev, 1, "the file was tried once in this run");
  assert.equal(left?.attempts, 0, "the re-queued removal's schedule stands, no back-off");
  assert.deepEqual(destroyed, []);
  // The delete may still go through at Cloudinary, so saves stay refused until the claim expires.
  assert.equal(left?.deletingUntil?.getTime(), now.getTime() + 10 * 60 * 1000);
});

const MIN = 60 * 1000;
// Runs one cleanup pass on a fake clock (only Date is faked), calling `between` after the worker's
// in-use check and before anything else it does with the ticket.
const cleanupWithPause = async (between: () => Promise<void>) => {
  mock.timers.enable({ apis: ["Date"], now: now.getTime() });
  let paused = false;
  const realExists = ProductModel.exists.bind(ProductModel);
  const existsMock = mock.method(ProductModel, "exists", (async (filter: object) => {
    const inUse = await realExists(filter);
    if (!paused) {
      paused = true;
      await between();
    }
    return inUse;
  }) as never);
  try {
    return await runUploadCleanup();
  } finally {
    existsMock.mock.restore();
    mock.timers.reset();
  }
};

test("a worker that stalls past its claim does not delete a file a product save has since claimed", async () => {
  const { claimUploadTickets } = await import("../src/modules/uploads/upload.service.js");
  await ticket("products/stalled", 30);
  const result = await cleanupWithPause(async () => {
    mock.timers.tick(11 * MIN); // the worker's 10-minute claim lapses
    await claimUploadTickets(["products/stalled"]); // a product save claims the image
  });
  assert.deepEqual(destroyed, [], "the stale worker must not delete it");
  assert.equal(result.deleted, 0);
  const left = await UploadTicketModel.findOne({ publicId: "products/stalled" }).lean();
  assert.ok(left && left.claimedUntil && left.claimedUntil > new Date(now.getTime() + 11 * MIN));
});

test("a removal queued between the in-use check and the delete stops the delete", async () => {
  const { queueImageRemoval } = await import("../src/modules/uploads/upload.service.js");
  await ticket("products/requeued-before-delete", 30);
  const result = await cleanupWithPause(async () => {
    await queueImageRemoval(["products/requeued-before-delete"], undefined, now);
  });
  assert.deepEqual(destroyed, [], "the removal's own grace period applies");
  assert.equal(result.deleted, 0);
  const left = await UploadTicketModel.findOne({
    publicId: "products/requeued-before-delete",
  }).lean();
  assert.equal(left?.reason, "removed");
  assert.equal(left?.deletingUntil ?? null, null, "the claim is given back");
});

test("a removal queued while Cloudinary is deleting the file keeps the ticket, and a later run settles it", async () => {
  const { queueImageRemoval } = await import("../src/modules/uploads/upload.service.js");
  await ticket("products/requeued-during-delete", 30);
  onDestroy = async () => {
    onDestroy = undefined;
    await queueImageRemoval(["products/requeued-during-delete"], undefined, now);
  };
  const first = await runUploadCleanup({ now });
  assert.deepEqual(destroyed, ["products/requeued-during-delete"]);
  assert.equal(first.failed, 0);
  const left = await UploadTicketModel.findOne({
    publicId: "products/requeued-during-delete",
  }).lean();
  assert.equal(left?.reason, "removed", "the newer removal isn't dropped by the older delete");
  assert.ok(
    left?.deletingUntil,
    "the claim is kept: the file really is gone, so saves are refused"
  );

  // After the claim and the grace period, the next run deletes again (a missing file counts as
  // deleted) and drops the ticket.
  const later = await runUploadCleanup({ now: new Date(now.getTime() + 16 * MIN) });
  assert.equal(later.failed, 0);
  assert.deepEqual(await ticketsLeft(), []);
});

test("an old worker giving its claim back can't clear a newer worker's claim", async () => {
  const { queueImageRemoval } = await import("../src/modules/uploads/upload.service.js");
  const ticketDoc = await ticket("products/two-workers", 30);
  await ProductModel.create({
    nameEn: "Uses two-workers",
    nameNp: "दुई",
    unit: "1 kg",
    slug: "uses-two-workers",
    category: categoryId,
    price: 100,
    stock: 1,
    images: [
      {
        url: `https://res.cloudinary.com/${CLOUD}/image/upload/products/two-workers.jpg`,
        publicId: "products/two-workers",
      },
    ],
  });
  let newerClaim: Date | undefined;
  await cleanupWithPause(async () => {
    mock.timers.tick(11 * MIN); // the first worker's claim lapses
    newerClaim = new Date(Date.now() + 10 * MIN);
    await UploadTicketModel.updateOne(
      { _id: ticketDoc._id },
      { $set: { deletingUntil: newerClaim } }
    );
    await queueImageRemoval(["products/two-workers"], undefined, new Date(Date.now()));
  });
  const left = await UploadTicketModel.findOne({ publicId: "products/two-workers" }).lean();
  assert.equal(
    left?.deletingUntil?.getTime(),
    newerClaim?.getTime(),
    "the newer worker still holds it"
  );
  assert.equal(left?.reason, "removed");
  assert.deepEqual(destroyed, []);
});

test("queueing a removal doesn't cut short a ticket's retry back-off", async () => {
  const { queueImageRemoval } = await import("../src/modules/uploads/upload.service.js");
  const backoffUntil = new Date(now.getTime() + 16 * HOUR);
  await ticket("products/backing-off", 30);
  await UploadTicketModel.updateOne(
    { publicId: "products/backing-off" },
    { $set: { attempts: 5, nextAttemptAt: backoffUntil, lastError: "Cloudinary answered 500" } }
  );
  await queueImageRemoval(["products/backing-off"], undefined, now);
  const left = await UploadTicketModel.findOne({ publicId: "products/backing-off" }).lean();
  assert.equal(
    left?.nextAttemptAt?.getTime(),
    backoffUntil.getTime(),
    "the later of the two times wins"
  );
  assert.equal(left?.attempts, 5);
  assert.equal(left?.reason, "removed");

  // A ticket with no back-off, or a shorter one, still gets the full 15-minute grace period.
  await ticket("products/no-backoff", 30);
  await queueImageRemoval(["products/no-backoff"], undefined, now);
  const fresh = await UploadTicketModel.findOne({ publicId: "products/no-backoff" }).lean();
  assert.equal(fresh?.nextAttemptAt?.getTime(), now.getTime() + 15 * MIN);
});

test("#1: after a failed delete the claim is kept, so a save can't attach a file whose delete may still land", async () => {
  const { claimUploadTickets } = await import("../src/modules/uploads/upload.service.js");
  await ticket("products/delete-timed-out", 30);
  failNext.add("products/delete-timed-out"); // e.g. our 10-second timeout fired
  const result = await runUploadCleanup({ now });
  assert.equal(result.failed, 1);
  const left = await UploadTicketModel.findOne({ publicId: "products/delete-timed-out" }).lean();
  assert.equal(left?.attempts, 1, "the retry is still recorded");
  assert.ok(left?.lastError);
  assert.equal(left?.deletingUntil?.getTime(), now.getTime() + 10 * MIN, "claim kept");
  await assert.rejects(
    claimUploadTickets(["products/delete-timed-out"], new Date(now.getTime() + 5 * MIN)),
    (err: { statusCode?: number; status?: number }) => (err.statusCode ?? err.status) === 409
  );
  // The retry still runs on the back-off schedule, after the claim has expired.
  failNext.clear();
  const retry = await runUploadCleanup({ now: new Date(now.getTime() + HOUR + MIN) });
  assert.equal(retry.deleted, 1);
});

test("#3: a renewed claim is the one the worker's later writes match", async () => {
  await ticket("products/renewed", 30);
  failNext.add("products/renewed");
  const result = await cleanupWithPause(async () => {
    mock.timers.tick(2 * MIN); // still within the claim, so the pre-delete check renews it
  });
  assert.equal(result.failed, 1);
  const left = await UploadTicketModel.findOne({ publicId: "products/renewed" }).lean();
  assert.equal(left?.attempts, 1, "the failure was recorded against the renewed claim");
  assert.equal(left?.deletingUntil?.getTime(), now.getTime() + 12 * MIN, "the renewed claim");
});

test("#5: a failed pre-delete check can't clear a newer worker's claim", async () => {
  const ticketDoc = await ticket("products/confirm-vs-newer", 30);
  let newerClaim: Date | undefined;
  const result = await cleanupWithPause(async () => {
    mock.timers.tick(11 * MIN); // this worker's claim lapses...
    newerClaim = new Date(Date.now() + 10 * MIN); // ...and a newer worker claims the ticket
    await UploadTicketModel.updateOne(
      { _id: ticketDoc._id },
      { $set: { deletingUntil: newerClaim } }
    );
  });
  assert.deepEqual(destroyed, [], "the stale worker doesn't delete");
  assert.equal(result.deleted, 0);
  const left = await UploadTicketModel.findOne({ publicId: "products/confirm-vs-newer" }).lean();
  assert.equal(
    left?.deletingUntil?.getTime(),
    newerClaim?.getTime(),
    "the newer worker still holds it"
  );
});

test("#6: a save's claim alone stops the delete, even while the worker's claim looks live", async () => {
  // Can only happen when the saving server's clock is ahead (R-13), but the check must hold.
  await ticket("products/save-claimed", 30);
  const result = await cleanupWithPause(async () => {
    mock.timers.tick(MIN);
    await UploadTicketModel.updateOne(
      { publicId: "products/save-claimed" },
      { $set: { claimedUntil: new Date(Date.now() + 15 * MIN) } }
    );
  });
  assert.deepEqual(destroyed, [], "a claimed image isn't deleted");
  assert.equal(result.deleted, 0);
  const left = await UploadTicketModel.findOne({ publicId: "products/save-claimed" }).lean();
  assert.ok(left?.claimedUntil, "the save's claim is untouched");
});

test("R-14: a save is refused when a worker gives its claim back between the claim and the check", async () => {
  const { claimUploadTickets } = await import("../src/modules/uploads/upload.service.js");
  // Worker A holds a live delete claim, so the save's claim step skips this ticket.
  const workerClaim = new Date(now.getTime() + MIN);
  const { _id } = await ticket("products/given-back", 30);
  await UploadTicketModel.updateOne({ _id }, { $set: { deletingUntil: workerClaim } });

  // Right after the save's claim step, worker A gives its claim back, exactly as giveBackClaim()
  // does when its pre-delete check finds the claim lapsed (A stalled past its own lease).
  let gaveBack = false;
  const realUpdateMany = UploadTicketModel.updateMany.bind(UploadTicketModel);
  const updateManyMock = mock.method(UploadTicketModel, "updateMany", (async (
    ...args: Parameters<typeof realUpdateMany>
  ) => {
    const res = await realUpdateMany(...args);
    await UploadTicketModel.updateOne(
      { _id, deletingUntil: workerClaim },
      { $set: { deletingUntil: null } }
    );
    gaveBack = true;
    return res;
  }) as never);

  try {
    // Without a save claim and without a worker claim, worker B could take the ticket and delete
    // the file before this save stores the product, so the save must be refused.
    await assert.rejects(claimUploadTickets(["products/given-back"], now), {
      statusCode: 409,
      code: "UPLOAD_EXPIRED",
    });
  } finally {
    updateManyMock.mock.restore();
  }

  assert.ok(gaveBack, "the give-back ran between the two database calls");
  const left = await UploadTicketModel.findOne({ _id }).lean();
  assert.equal(left?.deletingUntil, null, "no worker claim remains");
  assert.equal(left?.claimedUntil ?? null, null, "and the save holds no claim either");
});

test("a stalled worker whose claim lapsed doesn't delete, even after a save's claim has also lapsed", async () => {
  // Isolates the "claim still in the future" part of the pre-delete check: by the time the worker
  // resumes, its claim value is unchanged, no save claim is live and no removal was queued, so only
  // the lapsed claim stops it from deleting an image a product now uses.
  const { claimUploadTickets } = await import("../src/modules/uploads/upload.service.js");
  await ticket("products/stalled-long", 30);
  const result = await cleanupWithPause(async () => {
    mock.timers.tick(11 * MIN); // the worker's 10-minute claim lapses
    await claimUploadTickets(["products/stalled-long"]); // a save claims the image (15 minutes)...
    await ProductModel.create({
      nameEn: "Stalled Lentils",
      nameNp: "दाल",
      slug: "stalled-lentils",
      price: 300,
      unit: "1 kg",
      stock: 5,
      category: categoryId,
      images: [
        {
          url: `https://res.cloudinary.com/${CLOUD}/image/upload/products/stalled-long.jpg`,
          publicId: "products/stalled-long",
        },
      ],
    }); // ...and stores the product
    mock.timers.tick(16 * MIN); // the save's claim has lapsed too before the worker resumes
  });
  assert.deepEqual(destroyed, [], "an image a product uses must not be deleted");
  assert.equal(result.deleted, 0);
  // Having given its claim back, the same run claims the ticket afresh, finds the product and
  // settles the ticket as in use.
  assert.equal(result.inUse, 1);
  assert.equal(await UploadTicketModel.exists({ publicId: "products/stalled-long" }), null);
});

test("a failed delete's retry only falls due after the renewed claim has expired", async () => {
  // The worker is slow (9 minutes) between claiming and deleting, so the pre-delete check renews
  // the claim to 19 minutes. The back-off runs from the claim time, 1 hour, which still outlasts it.
  await ticket("products/slow-then-failed", 30);
  failNext.add("products/slow-then-failed");
  const result = await cleanupWithPause(async () => {
    mock.timers.tick(9 * MIN);
  });
  assert.equal(result.failed, 1);
  const left = await UploadTicketModel.findOne({ publicId: "products/slow-then-failed" }).lean();
  const claimEnds = left?.deletingUntil?.getTime() ?? 0;
  const retryAt = left?.nextAttemptAt?.getTime() ?? 0;
  assert.equal(claimEnds, now.getTime() + 19 * MIN, "the renewed claim is kept");
  assert.equal(retryAt, now.getTime() + HOUR, "the back-off counts from the claim time");
  assert.ok(retryAt > claimEnds, "the retry is never due while the claim is held");

  const afterClaim = await runUploadCleanup({ now: new Date(claimEnds + 1) });
  assert.equal(afterClaim.checked, 0, "a lapsed claim alone doesn't make the retry due");
  const due = await runUploadCleanup({ now: new Date(retryAt) });
  assert.equal(due.deleted, 1, "retried once the back-off ends");
});

test("the pre-delete check extends the claim, so saves stay refused past its first expiry", async () => {
  // The worker resumes 2 minutes after claiming. The renewal must move the claim to 12 minutes,
  // not keep the original 10, so a save 11 minutes in, while Cloudinary deletes, is refused.
  const { claimUploadTickets } = await import("../src/modules/uploads/upload.service.js");
  await ticket("products/extended", 30);
  let claimDuringDelete: number | undefined;
  let saveDuringDelete: unknown;
  onDestroy = async (publicId) => {
    const held = await UploadTicketModel.findOne({ publicId }).lean();
    claimDuringDelete = held?.deletingUntil?.getTime();
    saveDuringDelete = await claimUploadTickets([publicId], new Date(now.getTime() + 11 * MIN))
      .then(() => "allowed")
      .catch((err: unknown) => err);
  };
  const result = await cleanupWithPause(async () => {
    mock.timers.tick(2 * MIN);
  });
  assert.equal(claimDuringDelete, now.getTime() + 12 * MIN, "the claim was extended, not kept");
  assert.ok(claimDuringDelete! > now.getTime() + 10 * MIN);
  assert.equal((saveDuringDelete as { statusCode?: number }).statusCode, 409);
  assert.equal((saveDuringDelete as { code?: string }).code, "UPLOAD_EXPIRED");
  assert.equal(result.deleted, 1);
});
