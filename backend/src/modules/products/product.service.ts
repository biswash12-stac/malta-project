import type { QueryFilter, SortOrder } from "mongoose";
import { AppError } from "../../utils/app-error.js";
import type { PaginationQuery } from "../../utils/common.schema.js";
import { pageOf, skipFor } from "../../utils/pagination.js";
import { slugify } from "../../utils/slugify.js";
import { CategoryModel } from "../categories/category.model.js";
import { assertImagesAllowed, deleteImagesInBackground } from "../uploads/upload.service.js";
import { ProductModel, type Product } from "./product.model.js";
import { applyPriceRules } from "./product.pricing.js";
import type {
  AdminProductQuery,
  CreateProductInput,
  PublicProductQuery,
  UpdateProductInput,
} from "./product.schema.js";

const LIST_FIELDS =
  "nameEn nameNp slug price offerPrice priorLowestPrice unit stock category shopRating isFeatured";
const PUBLIC_LIST_FIELDS = `${LIST_FIELDS} images.url`;
const PUBLIC_DETAIL_FIELDS = `${PUBLIC_LIST_FIELDS} description`;
const ADMIN_FIELDS = `${LIST_FIELDS} images description isActive createdAt updatedAt`;

const listProducts = async (
  filter: QueryFilter<Product>,
  fields: string,
  categoryFields: string,
  pagination: PaginationQuery & { q?: string | undefined }
) => {
  const fullFilter: QueryFilter<Product> = pagination.q
    ? { ...filter, $text: { $search: pagination.q } }
    : filter;
  const sort: Record<string, SortOrder | { $meta: string }> = pagination.q
    ? ({ score: { $meta: "textScore" }, _id: -1 } as const)
    : ({ createdAt: -1, _id: -1 } as const);

  const [items, total] = await Promise.all([
    ProductModel.find(fullFilter)
      .select(fields)
      .sort(sort)
      .skip(skipFor(pagination))
      .limit(pagination.limit)
      .populate({ path: "category", select: categoryFields })
      .lean(),
    ProductModel.countDocuments(fullFilter),
  ]);
  return pageOf(items, total, pagination);
};

// Products keep their own isActive, so reactivating a category restores them as they were.
export const notInHiddenCategory = async (): Promise<QueryFilter<Product>> => {
  const hidden = await CategoryModel.find({ isActive: false }).select("_id").lean();
  return hidden.length > 0 ? { category: { $nin: hidden.map(({ _id }) => _id) } } : {};
};

export const listPublicProducts = async ({ category, featured, ...rest }: PublicProductQuery) => {
  const filter: QueryFilter<Product> = { isActive: true, ...(featured && { isFeatured: true }) };

  if (category) {
    const found = await CategoryModel.findOne({ slug: category, isActive: true })
      .select("_id")
      .lean();
    if (!found) return pageOf([], 0, rest);
    filter.category = found._id;
  } else {
    Object.assign(filter, await notInHiddenCategory());
  }
  return listProducts(filter, PUBLIC_LIST_FIELDS, "name slug", rest);
};

export const getPublicProduct = async (slug: string) => {
  const product = await ProductModel.findOne({
    slug,
    isActive: true,
    ...(await notInHiddenCategory()),
  })
    .select(PUBLIC_DETAIL_FIELDS)
    .populate({ path: "category", select: "name slug" })
    .lean();

  if (!product) throw AppError.notFound("Product not found");
  return product;
};

export const listAdminProducts = ({ category, isActive, ...rest }: AdminProductQuery) =>
  listProducts(
    {
      ...(category && { category }),
      ...(isActive !== undefined && { isActive }),
    },
    ADMIN_FIELDS,
    "name slug isActive",
    rest
  );

export const getAdminProduct = async (id: string) => {
  const product = await ProductModel.findById(id)
    .select(ADMIN_FIELDS)
    .populate({ path: "category", select: "name slug isActive" })
    .lean();

  if (!product) throw AppError.notFound("Product not found");
  return product;
};

const assertCategoryExists = async (id: string) => {
  if (!(await CategoryModel.exists({ _id: id }))) {
    throw AppError.badRequest("Invalid input", { category: ["Category not found"] });
  }
};

// Images no product uses yet, so each file is checked once and a rejected one can be deleted.
const assertNewImagesAllowed = async (images: { publicId: string }[] | undefined) => {
  const publicIds = (images ?? []).map((image) => image.publicId);
  if (publicIds.length === 0) return;
  const inUse = new Set<string>(
    await ProductModel.distinct("images.publicId", { "images.publicId": { $in: publicIds } })
  );
  await assertImagesAllowed(publicIds.filter((publicId) => !inUse.has(publicId)));
};

export const createProduct = async (input: CreateProductInput) => {
  await assertCategoryExists(input.category);
  await assertNewImagesAllowed(input.images);

  const product = new ProductModel({ ...input, slug: slugify(input.nameEn) });
  applyPriceRules(product, null);
  await product.save().catch((err: unknown) => {
    // Rely on the unique index, not a prior lookup: two parallel requests can't both pass.
    if ((err as { code?: number }).code === 11000) {
      throw AppError.conflict("A product with this English name already exists");
    }
    throw err;
  });
  return getAdminProduct(product.id);
};

export const updateProduct = async (id: string, input: UpdateProductInput) => {
  if (input.category) await assertCategoryExists(input.category);

  const product = await ProductModel.findById(id).select("+priceHistory");
  if (!product) throw AppError.notFound("Product not found");
  // After the 404 check, so editing a missing product never calls Cloudinary or deletes an upload.
  await assertNewImagesAllowed(input.images);

  const previousPrice = product.offerPrice ?? product.price;
  const previousImages = product.images.map((image) => image.publicId);
  // The slug isn't set here: product URLs stay the same when a product is renamed.
  product.set(input);
  applyPriceRules(product, previousPrice);
  await product.save(); // save() runs the model's offer price check against the stored price

  const kept = new Set(product.images.map((image) => image.publicId));
  await deleteUnusedImages(previousImages.filter((publicId) => !kept.has(publicId)));
  return getAdminProduct(id);
};

// Only after the save, so a rejected edit can't lose an image. Skips any image another product uses.
const deleteUnusedImages = async (publicIds: string[]) => {
  if (publicIds.length === 0) return;
  const inUse = new Set<string>(
    await ProductModel.distinct("images.publicId", { "images.publicId": { $in: publicIds } })
  );
  deleteImagesInBackground(publicIds.filter((publicId) => !inUse.has(publicId)));
};

// Soft delete: orders and history can still refer to the product.
export const deactivateProduct = async (id: string) => {
  const product = await ProductModel.findByIdAndUpdate(id, { isActive: false })
    .select("_id")
    .lean();
  if (!product) throw AppError.notFound("Product not found");
};
