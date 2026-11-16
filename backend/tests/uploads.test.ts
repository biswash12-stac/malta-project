import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { after, before, beforeEach, mock, test } from "node:test";
import { startAuthApp } from "./auth-test-app.js";

const CLOUD = "test-cloud";
const API_KEY = "test-api-key";
const SECRET = "test-api-secret-never-sent";

let t: Awaited<ReturnType<typeof startAuthApp>>;
let cloudinary: typeof import("../src/modules/uploads/upload.service.js").cloudinary;
let UploadTicketModel: typeof import("../src/modules/uploads/upload-ticket.model.js").UploadTicketModel;
let admin: InstanceType<Awaited<ReturnType<typeof startAuthApp>>["Client"]>;
let categoryId: string;
let destroyed: string[] = [];
let destroyMock: {
  mock: { restore: () => void; mockImplementationOnce: (f: () => Promise<void>) => void };
};
let count = 0;
// What the fake Cloudinary reports for each image. Unlisted images are small JPGs.
const MAX_BYTES = 5 * 1024 * 1024;
let stored = new Map<string, { bytes: number; format: string } | null>();
let checked: string[] = [];
let getImageMock: { mock: { restore: () => void } };
const fakeGetImage = async (publicId: string) => {
  checked.push(publicId);
  return stored.has(publicId) ? stored.get(publicId)! : { bytes: 100_000, format: "jpg" };
};

const image = (name: string) => ({
  url: `https://res.cloudinary.com/${CLOUD}/image/upload/v1700000000/products/${name}.jpg`,
  publicId: `products/${name}`,
});

const createProduct = async (images: unknown[]) => {
  const res = await admin.post("/products", {
    nameEn: `Item ${++count}`,
    nameNp: "सामान",
    price: 1000,
    unit: "1 kg",
    stock: 5,
    category: categoryId,
    images,
  });
  return res;
};

const patchImages = (id: string, images: unknown[]) =>
  admin.request("PATCH", `/products/${id}`, { images });

// Deletes run in the background, so give them a moment to finish.
const settle = () => new Promise((resolve) => setTimeout(resolve, 50));

before(async () => {
  process.env.CLOUDINARY_CLOUD_NAME = CLOUD;
  process.env.CLOUDINARY_API_KEY = API_KEY;
  process.env.CLOUDINARY_API_SECRET = SECRET;
  t = await startAuthApp();
  ({ cloudinary } = await import("../src/modules/uploads/upload.service.js"));
  ({ UploadTicketModel } = await import("../src/modules/uploads/upload-ticket.model.js"));

  destroyMock = mock.method(cloudinary, "destroy", async (publicId: string) => {
    destroyed.push(publicId);
  }) as never;
  getImageMock = mock.method(cloudinary, "getImage", fakeGetImage) as never;

  admin = new t.Client();
  await admin.register("admin@shop.test");
  await t.UserModel.updateOne({ email: "admin@shop.test" }, { role: "admin" });
  const category = await admin.post("/categories", { name: "Rice" });
  categoryId = category.body.data.category._id;
});
beforeEach(async () => {
  destroyed = [];
  stored = new Map();
  checked = [];
  await UploadTicketModel.deleteMany({});
  // A cleanup run with a future clock leaves its lock stamped in the future; start each test clean.
  await t.UserModel.db.collection("joblocks").deleteMany({});
});

// The hourly cleanup, run just after the 15-minute grace period that removed images wait out.
const cleanupAfterGrace = async (minutes = 16) => {
  const { runUploadCleanup } = await import("../src/modules/uploads/upload-cleanup.js");
  const result = await runUploadCleanup({ now: new Date(Date.now() + minutes * 60 * 1000) });
  await settle();
  return result;
};
after(async () => {
  destroyMock.mock.restore();
  getImageMock.mock.restore();
  await t.stop();
});

test("only admins can get an upload signature", async () => {
  assert.equal((await new t.Client().post("/admin/uploads/signature")).status, 401);
  const customer = new t.Client();
  await customer.register("customer@shop.test");
  assert.equal((await customer.post("/admin/uploads/signature")).status, 403);
});

test("the signature names one server-chosen file and matches Cloudinary's rule", async () => {
  const res = await admin.post("/admin/uploads/signature");
  assert.equal(res.status, 200);
  assert.ok(!res.raw.includes(SECRET));

  const data = res.body.data;
  assert.equal(data.uploadUrl, `https://api.cloudinary.com/v1_1/${CLOUD}/image/upload`);
  assert.equal(data.apiKey, API_KEY);
  assert.match(data.publicId, /^products\/[0-9a-f-]{36}$/);
  assert.equal(data.folder, undefined, "the public_id fixes the folder");
  assert.equal(data.overwrite, false, "a signature can never replace an image already checked");
  assert.ok(Math.abs(data.timestamp - Date.now() / 1000) < 5);
  assert.equal(
    data.signature,
    createHash("sha1")
      .update(
        `allowed_formats=${data.allowedFormats}&overwrite=false&public_id=${data.publicId}&timestamp=${data.timestamp}${SECRET}`
      )
      .digest("hex")
  );

  const again = (await admin.post("/admin/uploads/signature")).body.data;
  assert.notEqual(again.publicId, data.publicId, "every upload gets its own name");
});

test("each signature records an upload ticket for the admin who asked", async () => {
  const { publicId } = (await admin.post("/admin/uploads/signature")).body.data;
  const ticket = await UploadTicketModel.findOne({ publicId }).lean();
  const me = await t.UserModel.findOne({ email: "admin@shop.test" }).lean();
  assert.ok(ticket, "ticket saved");
  assert.equal(String(ticket?.createdBy), String(me?._id));
});

test("a saved image keeps its ticket until the cleanup confirms it is in use, then only the ticket goes", async () => {
  const { publicId } = (await admin.post("/admin/uploads/signature")).body.data;
  const name = publicId.slice("products/".length);
  assert.equal((await createProduct([image(name)])).status, 201);
  assert.equal(
    await UploadTicketModel.countDocuments({ publicId }),
    1,
    "settled by the cleanup, not the save"
  );
  await cleanupAfterGrace(60 * 25);
  assert.equal(await UploadTicketModel.countDocuments({ publicId }), 0);
  assert.ok(!destroyed.includes(publicId), "the file of a saved product is kept");
});

test("delete requests are signed correctly and don't contain the secret", async () => {
  destroyMock.mock.restore();
  let sent: { url: string; body: URLSearchParams } | undefined;
  const fetchMock = mock.method(globalThis, "fetch", async (url: string, init: RequestInit) => {
    sent = { url, body: init.body as URLSearchParams };
    return new Response(JSON.stringify({ result: "ok" }));
  });
  try {
    await cloudinary.destroy("products/old");
  } finally {
    fetchMock.mock.restore();
    destroyMock = mock.method(cloudinary, "destroy", async (publicId: string) => {
      destroyed.push(publicId);
    }) as never;
  }

  assert.equal(sent?.url, `https://api.cloudinary.com/v1_1/${CLOUD}/image/destroy`);
  const timestamp = sent?.body.get("timestamp");
  assert.equal(sent?.body.get("public_id"), "products/old");
  assert.equal(
    sent?.body.get("signature"),
    createHash("sha1")
      .update(`public_id=products/old&timestamp=${timestamp}${SECRET}`)
      .digest("hex")
  );
  assert.ok(!sent?.body.toString().includes(SECRET));
});

test("a failed delete request is reported", async () => {
  destroyMock.mock.restore();
  const fetchMock = mock.method(
    globalThis,
    "fetch",
    async () =>
      new Response(JSON.stringify({ error: { message: "Invalid signature" } }), { status: 401 })
  );
  try {
    await assert.rejects(cloudinary.destroy("products/old"), /401/);
  } finally {
    fetchMock.mock.restore();
    destroyMock = mock.method(cloudinary, "destroy", async (publicId: string) => {
      destroyed.push(publicId);
    }) as never;
  }
});

test("products only accept images from this store's account and folder", async () => {
  const bad = [
    { url: "https://evil.example.com/products/a.jpg", publicId: "products/a" },
    {
      url: `http://res.cloudinary.com/${CLOUD}/image/upload/products/a.jpg`,
      publicId: "products/a",
    },
    {
      url: "https://res.cloudinary.com/other-cloud/image/upload/products/a.jpg",
      publicId: "products/a",
    },
    {
      url: `https://res.cloudinary.com/${CLOUD}/video/upload/products/a.mp4`,
      publicId: "products/a",
    },
    { url: `https://res.cloudinary.com/${CLOUD}/image/upload/other/a.jpg`, publicId: "other/a" },
    {
      url: `https://res.cloudinary.com/${CLOUD}/image/upload/products/b.jpg`,
      publicId: "products/a",
    },
    { ...image("a"), extra: true },
  ];
  for (const candidate of bad) {
    const res = await createProduct([candidate]);
    assert.equal(res.status, 400, JSON.stringify(candidate));
  }
  assert.equal((await createProduct([image("good")])).status, 201);
});

test("image ids must be products/<one safe name>, and the url must point at exactly that file", async () => {
  const at = (path: string) => `https://res.cloudinary.com/${CLOUD}/image/upload/${path}`;
  const bad = [
    { url: at("v1/products/../secret/logo.jpg"), publicId: "products/../secret/logo" },
    { url: at("v1/products/./x.jpg"), publicId: "products/./x" },
    { url: at("v1/products//x.jpg"), publicId: "products//x" },
    { url: at("v1/products/a/b.jpg"), publicId: "products/a/b" },
    { url: at("v1/products/a.b.jpg"), publicId: "products/a.b" },
    { url: at("v1/products/has space.jpg"), publicId: "products/has space" },
    { url: at("v1/products/x.gif"), publicId: "products/x" },
    { url: at("v1/products/x.svg"), publicId: "products/x" },
    { url: at("v1/products/x.jpg?tracking=1"), publicId: "products/x" },
    { url: at("v1/products/x.jpg#frag"), publicId: "products/x" },
    {
      url: `https://res.cloudinary.com:8443/${CLOUD}/image/upload/v1/products/x.jpg`,
      publicId: "products/x",
    },
    {
      url: `https://user:pw@res.cloudinary.com/${CLOUD}/image/upload/v1/products/x.jpg`,
      publicId: "products/x",
    },
    { url: at("c_fill,w_9999/v1/products/x.jpg"), publicId: "products/x" },
    { url: at("v1/products/xy.jpg"), publicId: "products/x" },
    { url: at("v1/products/x.jpg"), publicId: `products/${"a".repeat(241)}` },
  ];
  for (const candidate of bad) {
    const res = await createProduct([candidate]);
    assert.equal(res.status, 400, JSON.stringify(candidate));
  }

  const uuid = "3f2b8c1e-9d4a-4f6b-8e2a-1c5d7e9f0a3b";
  const good = [
    { url: at(`v1700000000/products/${uuid}.webp`), publicId: `products/${uuid}` },
    { url: at("products/legacy_Id-42.png"), publicId: "products/legacy_Id-42" },
    { url: at(`v1/products/${"a".repeat(240)}.jpeg`), publicId: `products/${"a".repeat(240)}` },
  ];
  for (const candidate of good) {
    const res = await createProduct([candidate]);
    assert.equal(res.status, 201, JSON.stringify(candidate));
  }
});

test("R-11: a removed image is queued, not deleted, and the cleanup deletes it after the grace period", async () => {
  const { body } = await createProduct([image("keep"), image("remove")]);
  const res = await patchImages(body.data.product._id, [image("keep"), image("new")]);
  assert.equal(res.status, 200);
  await settle();
  assert.deepEqual(destroyed, [], "nothing is deleted straight away");

  const queued = await UploadTicketModel.findOne({ publicId: "products/remove" }).lean();
  assert.equal(queued?.reason, "removed");
  assert.equal(String(queued?.removedFrom), body.data.product._id);
  const wait = (queued?.nextAttemptAt?.getTime() ?? 0) - Date.now();
  assert.ok(wait > 14 * 60 * 1000 && wait <= 15 * 60 * 1000, `due in about 15 minutes: ${wait}`);

  assert.equal((await cleanupAfterGrace(10)).deleted, 0, "not before the grace period ends");
  await cleanupAfterGrace();
  assert.deepEqual(destroyed, ["products/remove"]);
  assert.equal(await UploadTicketModel.countDocuments({ publicId: "products/remove" }), 0);

  await cleanupAfterGrace();
  assert.deepEqual(destroyed, ["products/remove"], "repeat runs change nothing");
});

test("edits that don't change images delete nothing", async () => {
  const { body } = await createProduct([image("stay")]);
  const id = body.data.product._id;
  await admin.request("PATCH", `/products/${id}`, { stock: 9 });
  await patchImages(id, [image("stay")]);
  await admin.request("DELETE", `/products/${id}`);
  await settle();
  assert.deepEqual(destroyed, [], "soft delete keeps images, because it can be undone");
});

test("an image another product still uses isn't deleted", async () => {
  const first = await createProduct([image("shared")]);
  await createProduct([image("shared")]);
  await patchImages(first.body.data.product._id, []);
  const result = await cleanupAfterGrace();
  assert.deepEqual(destroyed, []);
  assert.ok(result.inUse >= 1);
  assert.equal(await UploadTicketModel.countDocuments({ publicId: "products/shared" }), 0);
});

test("a rejected edit deletes nothing", async () => {
  const { body } = await createProduct([image("safe")]);
  const res = await admin.request("PATCH", `/products/${body.data.product._id}`, {
    images: [],
    offerPrice: 5000,
  });
  assert.equal(res.status, 400);
  await cleanupAfterGrace();
  assert.deepEqual(destroyed, [], "the image is still on the product, so it is kept");
  assert.equal(await UploadTicketModel.countDocuments({ publicId: "products/safe" }), 0);
});

test("a failed delete of a removed image doesn't fail the edit, and is retried later", async () => {
  const { body } = await createProduct([image("stuck")]);
  const res = await patchImages(body.data.product._id, []);
  assert.equal(res.status, 200);
  assert.deepEqual(res.body.data.product.images, []);

  destroyMock.mock.mockImplementationOnce(async () => {
    throw new Error("Cloudinary is down");
  });
  const result = await cleanupAfterGrace();
  assert.equal(result.failed, 1);
  const retry = await UploadTicketModel.findOne({ publicId: "products/stuck" }).lean();
  assert.equal(retry?.attempts, 1);
  assert.ok(retry?.nextAttemptAt, "scheduled for a retry");
});

test("the signature tells the browser the size limit and allowed types", async () => {
  const { data } = (await admin.post("/admin/uploads/signature")).body;
  assert.equal(data.maxFileBytes, MAX_BYTES);
  assert.deepEqual(data.allowedMimeTypes, ["image/jpeg", "image/png", "image/webp"]);
});

test("an image at the size limit is accepted, and one byte over is rejected and deleted", async () => {
  stored.set("products/at-limit", { bytes: MAX_BYTES, format: "jpg" });
  stored.set("products/too-big", { bytes: MAX_BYTES + 1, format: "png" });

  assert.equal((await createProduct([image("at-limit")])).status, 201);
  const res = await createProduct([image("too-big")]);
  assert.equal(res.status, 400);
  assert.match(res.body.error.details.images[0], /5 MB/);
  await settle();
  assert.deepEqual(destroyed, [], "rejected files are queued, not deleted straight away");
  await cleanupAfterGrace();
  assert.deepEqual(destroyed, ["products/too-big"]);
});

test("an image Cloudinary stored in another format is rejected and deleted", async () => {
  stored.set("products/animated", { bytes: 1000, format: "gif" });
  const res = await createProduct([image("animated")]);
  assert.equal(res.status, 400);
  assert.match(res.body.error.details.images[0], /JPG, PNG or WebP/);
  await cleanupAfterGrace();
  assert.deepEqual(destroyed, ["products/animated"]);
});

test("an image that isn't in Cloudinary is rejected", async () => {
  stored.set("products/missing", null);
  const res = await createProduct([image("missing")]);
  assert.equal(res.status, 400);
  assert.match(res.body.error.details.images[0], /not found/);
});

test("an edit adding an oversized image is rejected and keeps the old images", async () => {
  const { body } = await createProduct([image("old")]);
  stored.set("products/huge", { bytes: MAX_BYTES * 2, format: "jpg" });
  const res = await patchImages(body.data.product._id, [image("huge")]);
  assert.equal(res.status, 400);
  const detail = await admin.get(`/admin/products/${body.data.product._id}`);
  assert.deepEqual(
    detail.body.data.product.images.map((i: { publicId: string }) => i.publicId),
    ["products/old"]
  );
  await cleanupAfterGrace();
  assert.deepEqual(
    destroyed,
    ["products/huge"],
    "the rejected file goes; the product's own image stays"
  );
});

test("images already on a product aren't checked again", async () => {
  const { body } = await createProduct([image("checked-once")]);
  checked = [];
  await patchImages(body.data.product._id, [image("checked-once")]);
  await createProduct([image("checked-once")]);
  assert.deepEqual(checked, []);
});

test("saving fails safely with a 503 when Cloudinary can't be reached", async () => {
  getImageMock.mock.restore();
  getImageMock = mock.method(cloudinary, "getImage", async () => {
    throw new Error("timeout");
  }) as never;
  try {
    const res = await createProduct([image("unreachable")]);
    assert.equal(res.status, 503);
    assert.equal(res.body.error.code, "IMAGE_CHECK_UNAVAILABLE");
  } finally {
    getImageMock.mock.restore();
    getImageMock = mock.method(cloudinary, "getImage", fakeGetImage) as never;
  }
  await settle();
  assert.deepEqual(destroyed, []);
});

test("a rejected save never deletes an image another product already uses", async () => {
  // An image attached before the size check existed, now reported as oversized.
  await createProduct([image("legacy")]);
  stored.set("products/legacy", { bytes: MAX_BYTES * 3, format: "jpg" });
  stored.set("products/new-huge", { bytes: MAX_BYTES + 1, format: "jpg" });
  checked = [];

  const res = await createProduct([image("legacy"), image("new-huge")]);
  assert.equal(res.status, 400);
  await cleanupAfterGrace();
  assert.deepEqual(destroyed, ["products/new-huge"]);
  assert.ok(!checked.includes("products/legacy"), "an image in use isn't checked again");
});

test("an edit fails with a 503 and keeps the old images when Cloudinary can't be reached", async () => {
  const { body } = await createProduct([image("before-outage")]);
  getImageMock.mock.restore();
  getImageMock = mock.method(cloudinary, "getImage", async () => {
    throw new Error("timeout");
  }) as never;
  try {
    const res = await patchImages(body.data.product._id, [image("during-outage")]);
    assert.equal(res.status, 503);
  } finally {
    getImageMock.mock.restore();
    getImageMock = mock.method(cloudinary, "getImage", fakeGetImage) as never;
  }
  const detail = await admin.get(`/admin/products/${body.data.product._id}`);
  assert.deepEqual(
    detail.body.data.product.images.map((i: { publicId: string }) => i.publicId),
    ["products/before-outage"]
  );
  await settle();
  assert.deepEqual(destroyed, []);
});

test("image checks use the Admin API with Basic auth, and a 404 means not found", async () => {
  getImageMock.mock.restore();
  const sent: { url: string; auth: string | null }[] = [];
  const fetchMock = mock.method(globalThis, "fetch", async (url: string, init: RequestInit) => {
    sent.push({ url, auth: new Headers(init.headers).get("authorization") });
    return url.endsWith("/gone")
      ? new Response(JSON.stringify({ error: { message: "Resource not found" } }), { status: 404 })
      : new Response(JSON.stringify({ bytes: 1234, format: "webp", public_id: "products/abc" }));
  });
  try {
    assert.deepEqual(await cloudinary.getImage("products/abc"), { bytes: 1234, format: "webp" });
    assert.equal(await cloudinary.getImage("products/gone"), null);
  } finally {
    fetchMock.mock.restore();
    getImageMock = mock.method(cloudinary, "getImage", fakeGetImage) as never;
  }
  assert.equal(
    sent[0]?.url,
    `https://api.cloudinary.com/v1_1/${CLOUD}/resources/image/upload/products/abc`
  );
  const basic = `Basic ${Buffer.from(`${API_KEY}:${SECRET}`).toString("base64")}`;
  assert.equal(sent[0]?.auth, basic);
});

test("editing a product that doesn't exist returns 404 without checking or deleting images", async () => {
  stored.set("products/orphan", { bytes: MAX_BYTES * 2, format: "jpg" });
  const res = await patchImages("507f1f77bcf86cd799439011", [image("orphan")]);
  assert.equal(res.status, 404);
  await settle();
  assert.deepEqual(checked, []);
  assert.deepEqual(destroyed, []);
});

test("a malformed Cloudinary image record fails closed with a 503 and deletes nothing", async () => {
  const malformed = [
    { format: "jpg" }, // bytes missing
    { bytes: "12", format: "jpg" }, // bytes not a number
    { bytes: 1000 }, // format missing
    { bytes: 1000, format: 7 }, // format not a string
  ];
  getImageMock.mock.restore();
  const realFetch = globalThis.fetch;
  let record: unknown;
  // Only the Admin API is faked. The test client's own requests still reach the app.
  const fetchMock = mock.method(globalThis, "fetch", (url: string, init?: RequestInit) =>
    String(url).startsWith("https://api.cloudinary.com/")
      ? Promise.resolve(new Response(JSON.stringify(record)))
      : realFetch(url, init)
  );
  try {
    for (const [i, body] of malformed.entries()) {
      record = body;
      const res = await createProduct([image(`malformed-${i}`)]);
      assert.equal(res.status, 503, JSON.stringify(body));
      assert.equal(res.body.error.code, "IMAGE_CHECK_UNAVAILABLE");
    }
  } finally {
    fetchMock.mock.restore();
    getImageMock = mock.method(cloudinary, "getImage", fakeGetImage) as never;
  }
  await settle();
  assert.deepEqual(destroyed, []);
});

test("upload signatures are rate limited: 60 per 15 minutes per IP", async () => {
  const busy = new t.Client();
  await busy.register("busy-admin@shop.test");
  await t.UserModel.updateOne({ email: "busy-admin@shop.test" }, { role: "admin" });
  for (let i = 0; i < 60; i++) {
    assert.equal((await busy.post("/admin/uploads/signature")).status, 200, `request ${i + 1}`);
  }
  const blocked = await busy.post("/admin/uploads/signature");
  assert.equal(blocked.status, 429);
  assert.equal(blocked.body.error.code, "RATE_LIMITED");
});

test("an unparseable image url is a 400, not a crash", async () => {
  for (const url of ["not a url", "https://", "http//res.cloudinary.com/x.jpg"]) {
    const res = await createProduct([{ url, publicId: "products/a" }]);
    assert.equal(res.status, 400, url);
  }
});

const DAY = 24 * 60 * 60 * 1000;
const signedImage = async () => {
  const { publicId } = (await admin.post("/admin/uploads/signature")).body.data;
  return image(publicId.slice("products/".length));
};

test("R-3: a save is refused while cleanup is deleting that image's ticket", async () => {
  const img = await signedImage();
  await UploadTicketModel.updateOne(
    { publicId: img.publicId },
    { deletingUntil: new Date(Date.now() + 5 * 60 * 1000) }
  );
  const res = await createProduct([img]);
  assert.equal(res.status, 409);
  assert.equal(res.body.error.code, "UPLOAD_EXPIRED");
  const saved = await admin.get(`/admin/products?q=${encodeURIComponent("Item")}&limit=50`);
  assert.ok(
    !saved.body.data.items.some((p: { images: { publicId: string }[] }) =>
      p.images?.some((i) => i.publicId === img.publicId)
    )
  );
});

test("R-3: cleanup running in the middle of a save skips the claimed ticket", async () => {
  const { runUploadCleanup } = await import("../src/modules/uploads/upload-cleanup.js");
  const img = await signedImage();
  // Uploaded over a day ago, so the hourly job is allowed to delete it if nothing claims it.
  await UploadTicketModel.updateOne(
    { publicId: img.publicId },
    { createdAt: new Date(Date.now() - DAY - 60_000) }
  );
  let duringSave: Awaited<ReturnType<typeof runUploadCleanup>> | undefined;
  getImageMock.mock.restore();
  getImageMock = mock.method(cloudinary, "getImage", async (publicId: string) => {
    if (publicId === img.publicId) {
      // The hourly job fires while the save is checking the image.
      duringSave = await runUploadCleanup();
    }
    return fakeGetImage(publicId);
  }) as never;
  try {
    assert.equal((await createProduct([img])).status, 201);
  } finally {
    getImageMock.mock.restore();
    getImageMock = mock.method(cloudinary, "getImage", fakeGetImage) as never;
  }
  await settle();
  assert.equal(duringSave?.status, "ok", "the cleanup really ran during the save");
  assert.equal(duringSave?.checked, 0, "the claimed ticket was skipped");
  assert.ok(!destroyed.includes(img.publicId), "the file of a saved product is never deleted");
});

test("R-7: two products saving the same new image at once both keep it", async () => {
  const { runUploadCleanup } = await import("../src/modules/uploads/upload-cleanup.js");
  const img = await signedImage();
  const [a, b] = await Promise.all([createProduct([img]), createProduct([img])]);
  assert.deepEqual([a.status, b.status], [201, 201]);
  await runUploadCleanup({ now: new Date(Date.now() + 2 * DAY) });
  await settle();
  assert.ok(!destroyed.includes(img.publicId));
  assert.equal(await UploadTicketModel.countDocuments({ publicId: img.publicId }), 0);
});

test("R-11: a save racing the cleanup of a removed image keeps the image", async () => {
  const { runUploadCleanup } = await import("../src/modules/uploads/upload-cleanup.js");
  const first = await createProduct([image("moving")]);
  await patchImages(first.body.data.product._id, []);
  // The grace period has passed: the cleanup may now delete it.
  await UploadTicketModel.updateOne(
    { publicId: "products/moving" },
    { nextAttemptAt: new Date(Date.now() - 1000) }
  );

  let duringSave: Awaited<ReturnType<typeof runUploadCleanup>> | undefined;
  getImageMock.mock.restore();
  getImageMock = mock.method(cloudinary, "getImage", async (publicId: string) => {
    if (publicId === "products/moving") duringSave = await runUploadCleanup();
    return fakeGetImage(publicId);
  }) as never;
  try {
    assert.equal((await createProduct([image("moving")])).status, 201);
  } finally {
    getImageMock.mock.restore();
    getImageMock = mock.method(cloudinary, "getImage", fakeGetImage) as never;
  }
  await settle();
  assert.equal(duringSave?.status, "ok", "the cleanup really ran during the save");
  assert.equal(duringSave?.checked, 0, "the save's claim made the cleanup skip it");
  assert.deepEqual(destroyed, []);
  // Once the save's claim has expired, the cleanup finds the image in use and keeps it.
  await cleanupAfterGrace();
  assert.deepEqual(destroyed, []);
  assert.equal(await UploadTicketModel.countDocuments({ publicId: "products/moving" }), 0);
});

test("R-11: saving an image whose removal is being deleted right now is refused", async () => {
  const first = await createProduct([image("going")]);
  await patchImages(first.body.data.product._id, []);
  await UploadTicketModel.updateOne(
    { publicId: "products/going" },
    { deletingUntil: new Date(Date.now() + 5 * 60 * 1000) }
  );
  const res = await createProduct([image("going")]);
  assert.equal(res.status, 409);
  assert.equal(res.body.error.code, "UPLOAD_EXPIRED");
});

test("R-11: adding a removed image back cancels its deletion", async () => {
  const { body } = await createProduct([image("back")]);
  await patchImages(body.data.product._id, []);
  await patchImages(body.data.product._id, [image("back")]);
  await cleanupAfterGrace();
  assert.deepEqual(destroyed, []);
  assert.equal(await UploadTicketModel.countDocuments({ publicId: "products/back" }), 0);
});

test("R-11: images already on products get no tickets and are never touched", async () => {
  await createProduct([image("legacy-attached")]);
  assert.equal(await UploadTicketModel.countDocuments({ publicId: "products/legacy-attached" }), 0);
  await cleanupAfterGrace(60 * 24 * 30);
  assert.ok(!destroyed.includes("products/legacy-attached"));
});

test("R-11: a stale edit of a product's images is refused with 409, and no file is lost or left untracked", async () => {
  // P starts with X. Edit E1 swaps X for a new upload Z; edit E2, made from the same old copy,
  // keeps X and adds a new upload Y. E2 saves while E1 is still checking Z, so E1's copy is stale.
  const { body } = await createProduct([image("stale-x")]);
  const id = body.data.product._id;
  const y = await signedImage();
  const z = await signedImage();
  getImageMock.mock.restore();
  let e2: Awaited<ReturnType<typeof patchImages>> | undefined;
  getImageMock = mock.method(cloudinary, "getImage", async (publicId: string) => {
    if (publicId === z.publicId && !e2) e2 = await patchImages(id, [image("stale-x"), y]);
    return fakeGetImage(publicId);
  }) as never;
  let e1;
  try {
    e1 = await patchImages(id, [z]);
  } finally {
    getImageMock.mock.restore();
    getImageMock = mock.method(cloudinary, "getImage", fakeGetImage) as never;
  }
  assert.equal(e2?.status, 200);
  assert.equal(e1.status, 409, "the stale edit can't overwrite the newer images");
  assert.equal(e1.body.error.code, "CONFLICT");
  const final = (await admin.get(`/admin/products/${id}`)).body.data.product;
  assert.deepEqual(
    final.images.map((i: { publicId: string }) => i.publicId),
    ["products/stale-x", y.publicId]
  );

  // X and Y are in use and kept; Z was never saved, is still tracked, and is deleted.
  await cleanupAfterGrace(60 * 25);
  assert.deepEqual(destroyed, [z.publicId]);
  assert.equal(await UploadTicketModel.countDocuments({}), 0, "every ticket settled");
});

// A cleanup worker claims X's due ticket and finds X in use; before it drops the ticket, an edit
// removes X from the product. `rev` is the ticket's revision before the race (none on old tickets).
const raceRemovalWithCleanup = async (name: string, rev?: number) => {
  const { ProductModel } = await import("../src/modules/products/product.model.js");
  const { runUploadCleanup } = await import("../src/modules/uploads/upload-cleanup.js");
  const publicId = `products/${name}`;
  const { body } = await createProduct([image(name)]);
  const id: string = body.data.product._id;
  await UploadTicketModel.create({
    publicId,
    createdAt: new Date(Date.now() - 2 * DAY),
    ...(rev !== undefined && { rev }),
  });

  const realExists = ProductModel.exists.bind(ProductModel);
  let triggered = false;
  let edit: Awaited<ReturnType<typeof patchImages>> | undefined;
  const existsMock = mock.method(ProductModel, "exists", (async (filter: object) => {
    const inUse = await realExists(filter);
    if (!triggered && JSON.stringify(filter).includes(publicId)) {
      triggered = true; // set before awaiting, so a nested call can't start a second edit
      edit = await patchImages(id, []);
    }
    return inUse;
  }) as never);
  let run;
  try {
    run = await runUploadCleanup();
  } finally {
    existsMock.mock.restore();
  }
  assert.equal(edit?.status, 200);
  assert.equal(run.checked, 1, "the worker really held the ticket during the edit");
  assert.equal(run.inUse, 0, "a superseded ticket isn't reported as settled");
  assert.equal(run.failed, 0, "no database error on the race path");
  assert.equal(run.status, "ok");
  return { id, publicId };
};

for (const rev of [undefined, 4]) {
  const label = rev === undefined ? "a ticket from before rev" : `rev ${rev}`;

  test(`R-11 defect 1 (${label}): a removal arriving while a cleanup worker holds the ticket is not lost`, async () => {
    const { publicId } = await raceRemovalWithCleanup(`raced-${rev ?? "old"}`, rev);
    const left = await UploadTicketModel.findOne({ publicId }).lean();
    assert.equal(left?.reason, "removed", "the removal survives the worker's in-use decision");
    assert.equal(left?.deletingUntil ?? null, null, "the superseded worker gave its claim back");
    await cleanupAfterGrace(25);
    assert.deepEqual(destroyed, [publicId], "the removed file is deleted after the grace period");
    assert.equal(await UploadTicketModel.countDocuments({ publicId }), 0);
  });

  test(`R-11 defect 1 (${label}): adding the image back right after the race succeeds and keeps it`, async () => {
    const { id, publicId } = await raceRemovalWithCleanup(`readded-${rev ?? "old"}`, rev);
    const name = publicId.slice("products/".length);
    assert.equal(
      (await patchImages(id, [image(name)])).status,
      200,
      "no stale 409 from the worker"
    );
    await cleanupAfterGrace(25);
    assert.deepEqual(destroyed, []);
    assert.equal(await UploadTicketModel.countDocuments({ publicId }), 0);
  });
}
