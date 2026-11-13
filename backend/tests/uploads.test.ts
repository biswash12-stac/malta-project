import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { after, before, beforeEach, mock, test } from "node:test";
import { startAuthApp } from "./auth-test-app.js";

const CLOUD = "test-cloud";
const API_KEY = "test-api-key";
const SECRET = "test-api-secret-never-sent";

let t: Awaited<ReturnType<typeof startAuthApp>>;
let cloudinary: typeof import("../src/modules/uploads/upload.service.js").cloudinary;
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
beforeEach(() => {
  destroyed = [];
  stored = new Map();
  checked = [];
});
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

test("the signature matches Cloudinary's rule and the secret is never sent", async () => {
  const res = await admin.post("/admin/uploads/signature");
  assert.equal(res.status, 200);
  assert.ok(!res.raw.includes(SECRET));

  const data = res.body.data;
  assert.equal(data.uploadUrl, `https://api.cloudinary.com/v1_1/${CLOUD}/image/upload`);
  assert.equal(data.apiKey, API_KEY);
  assert.equal(data.folder, "products");
  assert.ok(Math.abs(data.timestamp - Date.now() / 1000) < 5);
  assert.equal(
    data.signature,
    createHash("sha1")
      .update(
        `allowed_formats=${data.allowedFormats}&folder=products&timestamp=${data.timestamp}${SECRET}`
      )
      .digest("hex")
  );
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

test("replacing images deletes only the removed files", async () => {
  const { body } = await createProduct([image("keep"), image("remove")]);
  const res = await patchImages(body.data.product._id, [image("keep"), image("new")]);
  assert.equal(res.status, 200);
  await settle();
  assert.deepEqual(destroyed, ["products/remove"]);
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
  await settle();
  assert.deepEqual(destroyed, []);
});

test("a rejected edit deletes nothing", async () => {
  const { body } = await createProduct([image("safe")]);
  const res = await admin.request("PATCH", `/products/${body.data.product._id}`, {
    images: [],
    offerPrice: 5000,
  });
  assert.equal(res.status, 400);
  await settle();
  assert.deepEqual(destroyed, []);
});

test("a failed delete doesn't fail the product edit", async () => {
  const { body } = await createProduct([image("stuck")]);
  destroyMock.mock.mockImplementationOnce(async () => {
    throw new Error("Cloudinary is down");
  });
  const res = await patchImages(body.data.product._id, []);
  assert.equal(res.status, 200);
  assert.deepEqual(res.body.data.product.images, []);
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
  assert.deepEqual(destroyed, ["products/too-big"]);
});

test("an image Cloudinary stored in another format is rejected and deleted", async () => {
  stored.set("products/animated", { bytes: 1000, format: "gif" });
  const res = await createProduct([image("animated")]);
  assert.equal(res.status, 400);
  assert.match(res.body.error.details.images[0], /JPG, PNG or WebP/);
  await settle();
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
  await settle();
  assert.deepEqual(destroyed, ["products/huge"]);
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
  await settle();
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
