import { z } from "zod";

// z.coerce.number() would also accept "", "1e3" and "0x10", so only plain digits pass.
const positiveIntegerFromQuery = (max: number) =>
  z
    .string()
    .regex(/^\d+$/, "Must be a whole number")
    .transform(Number)
    .pipe(z.number().int().min(1).max(max));

// Strict, so unknown params such as `?price[$gt]=0` return a 400 instead of being ignored.
export const paginationQuerySchema = z.strictObject({
  // The cap stops a huge page number from forcing MongoDB to skip past the whole collection.
  page: positiveIntegerFromQuery(10_000).default(1),
  limit: positiveIntegerFromQuery(50).default(20),
});

export const objectIdSchema = z.string().regex(/^[0-9a-f]{24}$/i, "Invalid id");

export const objectIdParamSchema = z.object({
  id: objectIdSchema,
});

export type PaginationQuery = z.infer<typeof paginationQuerySchema>;
