import { z } from "zod";
import { slugify } from "../../utils/slugify.js";

const name = z
  .string()
  .trim()
  .min(1)
  .max(100)
  .refine((value) => slugify(value) !== "", "Must contain a letter or number");

export const createCategorySchema = z.strictObject({ name });

export const updateCategorySchema = z
  .strictObject({
    name: name.optional(),
    isActive: z.boolean().optional(),
  })
  .refine((body) => Object.keys(body).length > 0, "Send at least one field to update");

export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;
