import { Schema, model } from "mongoose";

export type Category = {
  name: string;
  slug: string;
  isActive: boolean;
};

const categorySchema = new Schema<Category>({
  name: { type: String, required: true, trim: true },
  slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
  isActive: { type: Boolean, default: true, required: true },
});

// Public category list: active categories sorted by name.
categorySchema.index({ isActive: 1, name: 1 });
// Admin category list: includes hidden categories, so it doesn't filter on isActive.
categorySchema.index({ name: 1 });

export const CategoryModel = model<Category>("Category", categorySchema);
