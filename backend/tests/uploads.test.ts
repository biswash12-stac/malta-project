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

  admin = new t.Client();
  await admin.register("admin@shop.test");
  await t.UserModel.updateOne({ email: "admin@shop.test" }, { role: "admin" });
  const category = await admin.post("/categories", { name: "Rice" });
  categoryId = category.body.data.category._id;
});
beforeEach(() => {
  destroyed = [];
});
after(async () => {
  destroyMock.mock.restore();
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
