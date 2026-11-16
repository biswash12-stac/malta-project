import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { startAuthApp } from "./auth-test-app.js";

let t: Awaited<ReturnType<typeof startAuthApp>>;
let seed: typeof import("../src/scripts/dev-catalog/seed-dev-catalog.js");
let DEV_CATALOG: typeof import("../src/scripts/dev-catalog/catalog-data.js").DEV_CATALOG;
let ProductModel: typeof import("../src/modules/products/product.model.js").ProductModel;
let CategoryModel: typeof import("../src/modules/categories/category.model.js").CategoryModel;
let slugify: typeof import("../src/utils/slugify.js").slugify;

const allProducts = () => DEV_CATALOG.flatMap((category) => category.products);

before(async () => {
  t = await startAuthApp();
  seed = await import("../src/scripts/dev-catalog/seed-dev-catalog.js");
  ({ DEV_CATALOG } = await import("../src/scripts/dev-catalog/catalog-data.js"));
  ({ ProductModel } = await import("../src/modules/products/product.model.js"));
  ({ CategoryModel } = await import("../src/modules/categories/category.model.js"));
  ({ slugify } = await import("../src/utils/slugify.js"));
});
after(async () => {
  await t.stop();
});

test("the seed catalogue has exactly 100 valid products in 14 non-empty categories", async () => {
  const { createProductSchema } = await import("../src/modules/products/product.schema.js");
  const products = allProducts();

  assert.equal(products.length, 100);
  assert.equal(DEV_CATALOG.length, 14);
  for (const category of DEV_CATALOG) assert.ok(category.products.length > 0, category.name);

  const slugs = products.map((p) => slugify(p.nameEn));
  assert.equal(new Set(slugs).size, 100, "every product slug is unique");
  assert.equal(new Set(DEV_CATALOG.map((c) => slugify(c.name))).size, 14);

  for (const p of products) {
    const parsed = createProductSchema.safeParse({ ...p, category: "507f1f77bcf86cd799439011" });
    assert.ok(parsed.success, `${p.nameEn}: ${JSON.stringify(parsed.error?.issues)}`);
    assert.ok(Number.isInteger(p.price) && p.price > 0, p.nameEn);
    if (p.offerPrice !== undefined) assert.ok(p.offerPrice < p.price, p.nameEn);
    assert.ok(!("images" in p) && !("shopRating" in p), "no images or ratings in seed data");
  }
  assert.ok(
    products.some((p) => p.stock === 0),
    "some products are out of stock"
  );
  assert.ok(
    products.some((p) => p.offerPrice !== undefined),
    "some products are on offer"
  );
});

test("seeding creates the 14 categories and 100 products, and a second run changes nothing", async () => {
  // Real data that already exists must be left alone, even when a seed slug matches it.
  const fruits = await CategoryModel.create({ name: "Fruits", slug: "fruits" });
  await ProductModel.create({
    nameEn: "Bananas",
    nameNp: "केरा",
    slug: "bananas",
    price: 999,
    unit: "client unit",
    stock: 1,
    category: fruits._id,
  });
  await ProductModel.create({
    nameEn: "Client Special",
    nameNp: "विशेष",
    slug: "client-special",
    price: 1234,
    unit: "1 piece",
    stock: 2,
    category: fruits._id,
  });

  const first = await seed.seedDevCatalog();
  assert.deepEqual(first.categories, { created: 13, reused: 1 });
  assert.deepEqual(first.products, { inserted: 99, skipped: 1, failed: 0 });
  assert.equal(first.seedProductsInDatabase, 100);
  assert.equal(first.expectedSeedProducts, 100, "the expected count comes from the catalogue data");

  const bananas = await ProductModel.findOne({ slug: "bananas" }).lean();
  assert.equal(bananas?.price, 999, "an existing product with a seed slug is not overwritten");
  assert.equal(await ProductModel.countDocuments({ slug: "client-special" }), 1);

  const second = await seed.seedDevCatalog();
  assert.deepEqual(second.categories, { created: 0, reused: 14 });
  assert.deepEqual(second.products, { inserted: 0, skipped: 100, failed: 0 });
  assert.equal(await ProductModel.countDocuments(), 101);
  assert.equal(await CategoryModel.countDocuments(), 14);
});

test("seeded offers keep the EU price-history rule", async () => {
  const ghee = await ProductModel.findOne({ slug: "pure-ghee-500-g" })
    .select("+priceHistory")
    .lean();
  assert.equal(ghee?.offerPrice, 999);
  assert.equal(ghee?.priorLowestPrice, 1149);
});

test("the seed refuses to run in production", async () => {
  await assert.rejects(seed.seedDevCatalog({ isProduction: true }), /production/);
});
