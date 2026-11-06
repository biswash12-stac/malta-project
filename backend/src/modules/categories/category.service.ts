import { AppError } from "../../utils/app-error.js";
import type { PaginationQuery } from "../../utils/common.schema.js";
import { pageOf, skipFor } from "../../utils/pagination.js";
import { slugify } from "../../utils/slugify.js";
import { CategoryModel } from "./category.model.js";
import type { CreateCategoryInput, UpdateCategoryInput } from "./category.schema.js";

const ADMIN_FIELDS = "name slug isActive";

const listCategories = async (
  filter: { isActive?: boolean },
  fields: string,
  pagination: PaginationQuery
) => {
  const [items, total] = await Promise.all([
    CategoryModel.find(filter)
      .select(fields)
      .sort({ name: 1 })
      .skip(skipFor(pagination))
      .limit(pagination.limit)
      .lean(),
    CategoryModel.countDocuments(filter),
  ]);
  return pageOf(items, total, pagination);
};

export const listActiveCategories = (pagination: PaginationQuery) =>
  listCategories({ isActive: true }, "name slug", pagination);

export const listAllCategories = (pagination: PaginationQuery) =>
  listCategories({}, ADMIN_FIELDS, pagination);

// Rely on the unique index, not a prior lookup: two parallel requests can't both pass.
const rethrowDuplicateAsConflict = (err: unknown): never => {
  if ((err as { code?: number }).code === 11000) {
    throw AppError.conflict("A category with this name already exists");
  }
  throw err;
};

export const createCategory = async ({ name }: CreateCategoryInput) => {
  const category = await CategoryModel.create({ name, slug: slugify(name) }).catch(
    rethrowDuplicateAsConflict
  );
  return {
    _id: category._id,
    name: category.name,
    slug: category.slug,
    isActive: category.isActive,
  };
};

export const updateCategory = async (id: string, { name, isActive }: UpdateCategoryInput) => {
  const category = await CategoryModel.findByIdAndUpdate(
    id,
    {
      // The slug follows the name, so its unique index also blocks renaming onto another category.
      ...(name !== undefined && { name, slug: slugify(name) }),
      ...(isActive !== undefined && { isActive }),
    },
    { returnDocument: "after", runValidators: true }
  )
    .select(ADMIN_FIELDS)
    .lean()
    .catch(rethrowDuplicateAsConflict);

  if (!category) throw AppError.notFound("Category not found");
  return category;
};

// Soft delete. Products keep their own isActive, so reactivating restores them as they were.
export const deactivateCategory = (id: string) => updateCategory(id, { isActive: false });
