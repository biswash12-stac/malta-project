import { env } from "../../config/env.js";
import { CategoryModel } from "../../modules/categories/category.model.js";
import { createCategory } from "../../modules/categories/category.service.js";
import { ProductModel } from "../../modules/products/product.model.js";
import { createProductSchema } from "../../modules/products/product.schema.js";
import { createProduct } from "../../modules/products/product.service.js";
import { logger } from "../../utils/logger.js";
import { slugify } from "../../utils/slugify.js";
import { DEV_CATALOG } from "./catalog-data.js";

export type SeedSummary = {
  categories: { created: number; reused: number };
  products: { inserted: number; skipped: number; failed: number };
  seedProductsInDatabase: number;
  expectedSeedProducts: number;
};

// Inserts the development catalogue. Insert-only: it matches by slug, skips anything that already
// exists (including real products with the same slug) and never updates or deletes a record.
// Products go through the normal createProduct service, so price rules match the API.
export const seedDevCatalog = async ({
  isProduction = env.isProduction,
}: { isProduction?: boolean } = {}): Promise<SeedSummary> => {
  if (isProduction) throw new Error("The development catalogue seed must never run in production");

  const summary: SeedSummary = {
    categories: { created: 0, reused: 0 },
    products: { inserted: 0, skipped: 0, failed: 0 },
    seedProductsInDatabase: 0,
    expectedSeedProducts: 0,
  };
  const seedSlugs = DEV_CATALOG.flatMap((c) => c.products.map((p) => slugify(p.nameEn)));
  const existing = new Set<string>(
    await ProductModel.distinct("slug", { slug: { $in: seedSlugs } })
  );

  for (const { name, products } of DEV_CATALOG) {
    const found = await CategoryModel.findOne({ slug: slugify(name) })
      .select("_id")
      .lean();
    let categoryId: string;
    if (found) {
      categoryId = String(found._id);
      summary.categories.reused++;
    } else {
      categoryId = String((await createCategory({ name }))._id);
      summary.categories.created++;
    }

    for (const product of products) {
      if (existing.has(slugify(product.nameEn))) {
        summary.products.skipped++;
        continue;
      }
      try {
        await createProduct(createProductSchema.parse({ ...product, category: categoryId }));
        summary.products.inserted++;
      } catch (err) {
        summary.products.failed++;
        logger.error({ msg: "Seed product failed", nameEn: product.nameEn, err: String(err) });
      }
    }
  }

  summary.seedProductsInDatabase = await ProductModel.countDocuments({ slug: { $in: seedSlugs } });
  summary.expectedSeedProducts = new Set(seedSlugs).size;
  return summary;
};
