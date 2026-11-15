import { z } from "zod";
import { env } from "../../config/env.js";
import { objectIdSchema, paginationQuerySchema } from "../../utils/common.schema.js";
import { slugify } from "../../utils/slugify.js";
import { UPLOAD_FOLDER } from "../uploads/upload.service.js";

const priceInCents = z.number().int().positive();

// The folder plus exactly one safe name: no dots, extra slashes or "..", so an id can never
// reach outside the folder (this id is what gets checked and deleted). Server-signed uploads
// are products/<uuid>; older Cloudinary ids are letters, digits, "_" and "-".
const PUBLIC_ID = new RegExp(`^${UPLOAD_FOLDER}/[A-Za-z0-9_-]{1,240}$`);
const IMAGE_EXTENSIONS = "jpe?g|png|webp";

const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// The url must be the canonical delivery url of exactly this file in our own account:
// /<cloud>/image/upload/[v<version>/]<publicId>.<allowed extension>, with nothing extra.
const isOwnImageUrl = (url: string, publicId: string) => {
  // Zod still runs this refine when the url field itself failed, so an unparseable url must not throw.
  if (!URL.canParse(url)) return false;
  const parsed = new URL(url);
  if (parsed.href !== url) return false;
  if (parsed.username || parsed.password || parsed.port || parsed.search || parsed.hash) {
    return false;
  }
  const cloud = escapeRegExp(env.CLOUDINARY_CLOUD_NAME);
  return new RegExp(
    `^/${cloud}/image/upload/(?:v\\d+/)?${escapeRegExp(publicId)}\\.(?:${IMAGE_EXTENSIONS})$`
  ).test(parsed.pathname);
};

const productImageSchema = z
  .strictObject({
    url: z.url({ protocol: /^https$/, hostname: /^res\.cloudinary\.com$/ }),
    publicId: z.string().regex(PUBLIC_ID, "Invalid image id"),
  })
  // Only images in our own account and folder, so a product can't point at someone else's files.
  .refine(
    ({ url, publicId }) => isOwnImageUrl(url, publicId),
    "Image must be one uploaded to this store"
  );

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
