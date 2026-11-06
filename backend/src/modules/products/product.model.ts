import { Schema, model, type Types } from "mongoose";

export type ProductImage = {
  url: string;
  // Cloudinary's id for the file, needed to delete it when an image is replaced.
  publicId: string;
};

export type PriceRecord = {
  price: number;
  from: Date;
};

export type Product = {
  nameEn: string;
  nameNp: string;
  slug: string;
  description: string;
  price: number; // integer cents (EUR)
  offerPrice: number | null; // integer cents, lower than price
  // EU rule: an offer must reference the lowest price of the previous 30 days.
  priorLowestPrice: number | null;
  priceHistory: PriceRecord[];
  unit: string;
  stock: number;
  images: ProductImage[];
  category: Types.ObjectId;
  shopRating: number | null; // the shop's own 1-5 rating, not customer reviews
  isFeatured: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

const nonNegativeInteger = (field: string) => ({
  min: [0, `${field} cannot be negative`] as [number, string],
  validate: {
    validator: (value: number | null) => value === null || Number.isInteger(value),
    message: `${field} must be a whole number`,
  },
});

const productImageSchema = new Schema<ProductImage>(
  {
    url: { type: String, required: true },
    publicId: { type: String, required: true },
  },
  { _id: false }
);

const productSchema = new Schema<Product>(
  {
    nameEn: { type: String, required: true, trim: true },
    nameNp: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    description: { type: String, trim: true, default: "" },
    price: { type: Number, required: true, ...nonNegativeInteger("Price") },
    offerPrice: { type: Number, default: null, ...nonNegativeInteger("Offer price") },
    priorLowestPrice: { type: Number, default: null },
    priceHistory: {
      type: [new Schema<PriceRecord>({ price: Number, from: Date }, { _id: false })],
      default: [],
      select: false,
    },
    unit: { type: String, required: true, trim: true },
    stock: { type: Number, required: true, ...nonNegativeInteger("Stock") },
    images: { type: [productImageSchema], default: [] },
    category: { type: Schema.Types.ObjectId, ref: "Category", required: true },
    shopRating: {
      type: Number,
      default: null,
      min: [1, "Rating must be at least 1"],
      max: [5, "Rating cannot be more than 5"],
    },
    isFeatured: { type: Boolean, default: false, required: true },
    isActive: { type: Boolean, default: true, required: true },
  },
  { timestamps: true }
);

// Compares against the stored price too, so editing only one of the two prices is still checked.
// Runs on save only: change price or offerPrice with doc.save(), never findOneAndUpdate.
productSchema.pre("validate", function () {
  if (this.offerPrice !== null && this.offerPrice >= this.price) {
    this.invalidate("offerPrice", "Offer price must be lower than the price", this.offerPrice);
  }
});

// Each index ends in createdAt + _id so MongoDB reads lists already sorted, newest first,
// and _id keeps the page order stable when two products share a timestamp.
const NEWEST_FIRST = { createdAt: -1, _id: -1 } as const;

// Public: all products, one category, and the home page's featured products.
productSchema.index({ isActive: 1, ...NEWEST_FIRST });
productSchema.index({ category: 1, isActive: 1, ...NEWEST_FIRST });
productSchema.index({ isFeatured: 1, isActive: 1, ...NEWEST_FIRST });

// Admin: sees inactive products too, so these lists don't filter on isActive.
productSchema.index(NEWEST_FIRST);
productSchema.index({ category: 1, ...NEWEST_FIRST });

// Search. A collection can only have one text index, and it can't serve the sorts above.
productSchema.index(
  { nameEn: "text", nameNp: "text", description: "text" },
  { name: "product_search", weights: { nameEn: 10, nameNp: 10, description: 1 } }
);

export const ProductModel = model<Product>("Product", productSchema);
