import { z } from "zod";
import { objectIdSchema, paginationQuerySchema } from "../../utils/common.schema.js";
import { slugify } from "../../utils/slugify.js";

const priceInCents = z.number().int().positive();

const productImageSchema = z.strictObject({
  // Only Cloudinary images over HTTPS, so a product can't point at an arbitrary site.
  url: z.url({ protocol: /^https$/, hostname: /^res\.cloudinary\.com$/ }),
  publicId: z.string().min(1).max(255),
});

const productFields = {
  nameEn: z
    .string()
    .trim()
    .min(1)
    .max(150)
    .refine((value) => slugify(value) !== "", "Must contain a letter or number"),
  nameNp: z.string().trim().min(1).max(150),
  price: priceInCents,
  unit: z.string().trim().min(1).max(50),
  stock: z.number().int().nonnegative(),
  category: objectIdSchema,
  description: z.string().trim().max(5000).optional(),
  offerPrice: priceInCents.nullable().optional(),
  images: z.array(productImageSchema).max(10).optional(),
  shopRating: z.number().min(1).max(5).nullable().optional(),
  isFeatured: z.boolean().optional(),
  isActive: z.boolean().optional(),
};

const offerIsBelowPrice = ({
  price,
  offerPrice,
}: {
  price?: number | undefined;
  offerPrice?: number | null | undefined;
}) => price === undefined || offerPrice === undefined || offerPrice === null || offerPrice < price;

const offerPriceError = {
  message: "Offer price must be lower than the price",
  path: ["offerPrice"],
};

export const createProductSchema = z
  .strictObject(productFields)
  .refine(offerIsBelowPrice, offerPriceError);

// When only one price is sent, the model checks it against the stored price on save.
export const updateProductSchema = z
  .strictObject(productFields)
  .partial()
  .refine(offerIsBelowPrice, offerPriceError)
  .refine((body) => Object.keys(body).length > 0, "Send at least one field to update");

const slug = z.string().trim().toLowerCase().min(1).max(200);
const search = z.string().trim().min(1).max(100);

export const productSlugParamSchema = z.object({ slug });

export const publicProductQuerySchema = paginationQuerySchema.extend({
  q: search.optional(),
  category: slug.optional(),
  featured: z
    .literal("true")
    .transform(() => true)
    .optional(),
});

export const adminProductQuerySchema = paginationQuerySchema.extend({
  q: search.optional(),
  category: objectIdSchema.optional(),
  isActive: z
    .enum(["true", "false"])
    .transform((value) => value === "true")
    .optional(),
});

export type PublicProductQuery = z.infer<typeof publicProductQuerySchema>;
export type AdminProductQuery = z.infer<typeof adminProductQuerySchema>;
export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
