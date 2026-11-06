import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import mongoose, { type Query } from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";

let mongo: MongoMemoryServer;
let CategoryModel: typeof import("../src/modules/categories/category.model.js").CategoryModel;
let ProductModel: typeof import("../src/modules/products/product.model.js").ProductModel;
let createProductSchema: typeof import("../src/modules/products/product.schema.js").createProductSchema;
let updateProductSchema: typeof import("../src/modules/products/product.schema.js").updateProductSchema;
const categoryId = new mongoose.Types.ObjectId();

const product = (overrides: Record<string, unknown>) => ({
  nameEn: "Plain Item",
  nameNp: "सादा सामान",
  slug: `product-${new mongoose.Types.ObjectId()}`,
  price: 399,
  unit: "1 kg",
  stock: 5,
  category: categoryId,
  ...overrides,
});

// A valid request body for the create schema.
const createBody = (overrides: Record<string, unknown> = {}) => ({
  nameEn: "Basmati Rice",
  nameNp: "बासमती चामल",
  price: 1299,
  unit: "5 kg",
  stock: 10,
  category: categoryId.toString(),
  ...overrides,
});

// Fails if MongoDB would scan the whole collection or sort in memory, the two things
// that make a list slower as the catalog grows.
const assertUsesIndexForFilterAndSort = async (query: Query<unknown, unknown>) => {
  const { queryPlanner } = (await query.explain("queryPlanner")) as {
    queryPlanner: { winningPlan: unknown };
  };
  const plan = JSON.stringify(queryPlanner.winningPlan);
  assert.match(plan, /IXSCAN/);
  assert.doesNotMatch(plan, /COLLSCAN/);
  assert.doesNotMatch(plan, /"stage":"SORT"/);
};

before(async () => {
  mongo = await MongoMemoryServer.create();
  // Set before the app loads, so tests can never touch the database in .env.
  process.env.MONGODB_URI = mongo.getUri("test");
  process.env.JWT_SECRET = "test-secret-".repeat(4);
  process.env.NODE_ENV = "test";
  process.env.LOG_LEVEL = "fatal";
  process.env.CLOUDINARY_CLOUD_NAME = "demo";

  ({ CategoryModel } = await import("../src/modules/categories/category.model.js"));
  ({ ProductModel } = await import("../src/modules/products/product.model.js"));
  ({ createProductSchema, updateProductSchema } =
    await import("../src/modules/products/product.schema.js"));
  const { connectDB } = await import("../src/config/db.js");
  await connectDB();
  await Promise.all([CategoryModel.init(), ProductModel.init()]);

  await ProductModel.create([
    product({
      nameEn: "Himalayan Tea",
      nameNp: "हिमाली चिया",
      description: "Loose leaf",
      isFeatured: true,
    }),
    product({ nameEn: "Green Apples", nameNp: "हरियो स्याउ", description: "Crisp" }),
    product({ nameEn: "Hidden Rice", nameNp: "लुकेको चामल", isActive: false }),
  ]);
});

after(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});

test("price, offer price and stock must be non-negative whole numbers", async () => {
  for (const bad of [
    { price: 3.99 },
    { price: -1 },
    { stock: 1.5 },
    { stock: -1 },
    { offerPrice: 1.5 },
    { offerPrice: -1 },
  ]) {
    await assert.rejects(
      new ProductModel(product(bad)).validate(),
      /whole number|negative/,
      JSON.stringify(bad)
    );
  }
});

test("both names are required and new fields default to null", async () => {
  for (const missing of ["nameEn", "nameNp"]) {
    await assert.rejects(new ProductModel(product({ [missing]: undefined })).validate(), {
      name: "ValidationError",
    });
  }
  const created = new ProductModel(product({}));
  await created.validate();
  assert.equal(created.offerPrice, null);
  assert.equal(created.shopRating, null);
  assert.equal(created.description, "");
});

test("the model keeps offer price below price, even when one is edited alone", async () => {
  for (const offerPrice of [399, 400]) {
    await assert.rejects(new ProductModel(product({ offerPrice })).validate(), /lower than/);
  }

  const saved = await ProductModel.create(product({ price: 1000, offerPrice: 800 }));

  saved.offerPrice = 1000;
  await assert.rejects(saved.save(), /lower than/);

  const reloaded = await ProductModel.findById(saved._id).orFail();
  reloaded.price = 700;
  await assert.rejects(reloaded.save(), /lower than/);

  const cleared = await ProductModel.findById(saved._id).orFail();
  cleared.offerPrice = null;
  cleared.price = 700;
  await cleared.save();
});

test("a broken price rule returns a 400 naming the field", async () => {
  const { errorHandler } = await import("../src/middlewares/error.middleware.js");
  const invalid = await new ProductModel(product({ offerPrice: 500 }))
    .validate()
    .catch((err: unknown) => err);

  const sent: { status?: number; body?: { error: { details: Record<string, string[]> } } } = {};
  const res = {
    status(code: number) {
      sent.status = code;
      return this;
    },
    json(body: typeof sent.body) {
      sent.body = body;
      return this;
    },
  };
  errorHandler(invalid, { originalUrl: "/", method: "POST" } as never, res as never, () => {});

  assert.equal(sent.status, 400);
  assert.deepEqual(sent.body?.error.details.offerPrice, [
    "Offer price must be lower than the price",
  ]);
});

test("the admin rating must be from 1 to 5", async () => {
  for (const shopRating of [0, 0.9, 5.1, 6]) {
    await assert.rejects(new ProductModel(product({ shopRating })).validate(), /Rating/);
  }
  for (const shopRating of [1, 4.5, 5, null]) {
    await new ProductModel(product({ shopRating })).validate();
  }
});

test("slugs are unique, ignoring case", async () => {
  await ProductModel.create(product({ slug: "basmati-rice" }));
  await assert.rejects(ProductModel.create(product({ slug: "BASMATI-RICE" })), { code: 11000 });

  await CategoryModel.create({ name: "Spices", slug: "spices" });
  await assert.rejects(CategoryModel.create({ name: "More Spices", slug: "SPICES" }), {
    code: 11000,
  });
});

test("every list query is served by an index in sorted order", async () => {
  const newest = { createdAt: -1, _id: -1 } as const;
  await assertUsesIndexForFilterAndSort(CategoryModel.find({}).sort({ name: 1 }).limit(50));
  const lists = [
    { isActive: true },
    { category: categoryId, isActive: true },
    { category: { $nin: [new mongoose.Types.ObjectId()] }, isActive: true },
    { isFeatured: true, isActive: true },
    {},
    { category: categoryId },
  ];
  for (const filter of lists) {
    await assertUsesIndexForFilterAndSort(ProductModel.find(filter).sort(newest).limit(20));
  }
  await assertUsesIndexForFilterAndSort(
    CategoryModel.find({ isActive: true }).sort({ name: 1 }).limit(50)
  );
});

test("the text index covers both names and the description, ranking names first", async () => {
  const indexes = await ProductModel.collection.indexes();
  const textIndex = indexes.find((index) => index.name === "product_search");
  assert.deepEqual(textIndex?.weights, { description: 1, nameEn: 10, nameNp: 10 });

  const search = async (text: string) => {
    const docs = await ProductModel.find(
      { $text: { $search: text }, isActive: true },
      { score: { $meta: "textScore" } }
    )
      .sort({ score: { $meta: "textScore" } })
      .lean();
    return docs.map((doc) => doc.nameEn);
  };

  assert.deepEqual(await search("apple"), ["Green Apples"], "English, matching word forms");
  assert.deepEqual(await search("स्याउ"), ["Green Apples"], "Nepali");
  assert.deepEqual(await search("crisp"), ["Green Apples"], "description");
  assert.deepEqual(await search("rice"), [], "inactive products stay out of public search");

  await ProductModel.create(
    product({ nameEn: "Tea Mug", description: "Holds fruit" }),
    product({ nameEn: "Fruit Basket", description: "Woven" })
  );
  assert.equal((await search("fruit"))[0], "Fruit Basket");
});

test("the create schema accepts a valid product and rejects bad ones", () => {
  assert.ok(createProductSchema.safeParse(createBody()).success);
  assert.ok(
    createProductSchema.safeParse(
      createBody({
        offerPrice: 999,
        shopRating: 4.5,
        description: "Long grain",
        images: [
          {
            url: "https://res.cloudinary.com/demo/image/upload/v1/products/a.jpg",
            publicId: "products/a",
          },
        ],
      })
    ).success
  );

  const rejects: [string, Record<string, unknown>][] = [
    ["nameEn", { nameEn: "" }],
    ["nameEn", { nameEn: "!!!" }],
    ["nameNp", { nameNp: " " }],
    ["nameNp", { nameNp: undefined }],
    ["price", { price: 12.99 }],
    ["price", { price: 0 }],
    ["price", { price: "1299" }],
    ["offerPrice", { offerPrice: 1299 }],
    ["offerPrice", { offerPrice: 1300 }],
    ["shopRating", { shopRating: 0 }],
    ["shopRating", { shopRating: 5.5 }],
    ["stock", { stock: -1 }],
    ["category", { category: "abc" }],
    ["images", { images: [{ url: "http://res.cloudinary.com/a.jpg", publicId: "a" }] }],
    ["images", { images: [{ url: "https://evil.example.com/a.jpg", publicId: "a" }] }],
  ];
  for (const [field, overrides] of rejects) {
    const result = createProductSchema.safeParse(createBody(overrides));
    assert.equal(result.success, false, JSON.stringify(overrides));
    assert.equal(result.error?.issues[0]?.path[0], field, JSON.stringify(overrides));
  }

  // The slug comes from nameEn on the server, so a client can't set it.
  assert.equal(createProductSchema.safeParse(createBody({ slug: "mine" })).success, false);
  assert.equal(createProductSchema.safeParse(createBody({ name: "Old field" })).success, false);
});

test("the update schema allows partial edits and checks prices sent together", () => {
  assert.ok(updateProductSchema.safeParse({ offerPrice: 500 }).success);
  assert.ok(updateProductSchema.safeParse({ offerPrice: null }).success);
  assert.ok(updateProductSchema.safeParse({ shopRating: null }).success);
  assert.ok(updateProductSchema.safeParse({ price: 900, offerPrice: 800 }).success);
  assert.equal(updateProductSchema.safeParse({ price: 800, offerPrice: 800 }).success, false);
  assert.equal(updateProductSchema.safeParse({}).success, false);
});
