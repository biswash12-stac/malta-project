
"use client";

import { useState, useSyncExternalStore, type FormEvent } from "react";
import type { AdminProduct } from "@/lib/product-storage";
import ProductImageUpload from "./ProductImageUpload";

import {
  getCategoriesSnapshot,
  getServerCategoriesSnapshot,
  subscribeToCategories,
} from "@/lib/category-storage";

export type ProductFormValues = {
  name: string;
  nameNp: string;
  category: string;
  price: string;
  originalPrice: string;
  stock: string;
  image: string;
  imageFile: File | null;
  description: string;
  badge: string;
  isVisible: boolean;
};

type ProductFormProps = {
  mode: "add" | "edit";
  initialData?: AdminProduct;
  onSubmit: (values: ProductFormValues) => void;
  onCancel: () => void;
};

export default function ProductForm({
  mode,
  initialData,
  onSubmit,
  onCancel,
}: ProductFormProps) {
  const [imageFile, setImageFile] = useState<File | null>(null);

  const categories = useSyncExternalStore(
    subscribeToCategories,
    getCategoriesSnapshot,
    getServerCategoriesSnapshot
  );

  const availableCategories = categories.filter(
    (category) => category.isVisible
  );

  const currentCategoryIsHidden =
    mode === "edit" &&
    initialData?.category &&
    !availableCategories.some(
      (category) => category.name === initialData.category
    );

  const [formData, setFormData] = useState({
    name: initialData?.name ?? "",
    nameNp: initialData?.nameNp ?? "",
    category: initialData?.category ?? "",
    price: initialData?.price?.toString() ?? "",
    originalPrice: initialData?.originalPrice?.toString() ?? "",
    stock: initialData?.stock?.toString() ?? "0",
    image: initialData?.image ?? "",
    description: initialData?.description ?? "",
    badge: initialData?.badge ?? "",
    isVisible: initialData?.isVisible ?? true,
  });

  function handleChange(
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ) {
    const { name, value } = e.target;

    setFormData((previous) => ({
      ...previous,
      [name]: value,
    }));
  }

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    const price = Number(formData.price);
    const originalPrice = Number(formData.originalPrice);
    const stock = Number(formData.stock);

    if (!formData.name.trim()) {
      alert("Please enter the product name.");
      return;
    }

    if (!formData.category) {
      alert("Please select a category.");
      return;
    }

    if (
      !formData.image.trim() &&
      !imageFile
    ) {
      alert("Please select a product image.");
      return;
    }

    if (!Number.isFinite(price) || price <= 0) {
      alert("Please enter a valid selling price.");
      return;
    }

    if (
      formData.originalPrice.trim() &&
      (!Number.isFinite(originalPrice) || originalPrice <= price)
    ) {
      alert("Original price must be greater than selling price.");
      return;
    }

    if (!Number.isInteger(stock) || stock < 0) {
      alert("Stock must be a non-negative whole number.");
      return;
    }

    onSubmit({
      ...formData,
      imageFile,
    });
  }

  const inputClass =
    "w-full rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm text-gray-800 outline-none transition focus:border-black";

  const labelClass =
    "mb-2 block text-sm font-medium text-gray-700";

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
    
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <div>
          <label className={labelClass}>
            Product Name (English) *
          </label>

          <input
            type="text"
            name="name"
            value={formData.name}
            onChange={handleChange}
            placeholder="Fresh Organic Apples"
            className={inputClass}
            required
          />
        </div>

        <div>
          <label className={labelClass}>
            Product Name (Nepali)
          </label>

          <input
            type="text"
            name="nameNp"
            value={formData.nameNp}
            onChange={handleChange}
            placeholder="ताजा अर्गानिक स्याउ"
            className={inputClass}
          />
        </div>
      </div>

     
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <div>
          <label className={labelClass}>
            Category *
          </label>

          <select
            name="category"
            value={formData.category}
            onChange={handleChange}
            className={inputClass}
            required
          >
            <option value="">Select category</option>

            {availableCategories.map((category) => (
              <option key={category.id} value={category.name}>
                {category.name} {category.nameNp && `(${category.nameNp})`}
              </option>
            ))}

            {currentCategoryIsHidden && (
              <option value={initialData?.category} disabled>
                {initialData?.category} (Hidden category)
              </option>
            )}
          </select>

          {availableCategories.length === 0 && (
            <p className="mt-2 text-xs text-orange-600">
              No visible categories available. Create or show a category first.
            </p>
          )}
        </div>

        <div>
          <label className={labelClass}>
            Product Badge
          </label>

          <input
            type="text"
            name="badge"
            value={formData.badge}
            onChange={handleChange}
            placeholder="Best Seller, New, Organic..."
            className={inputClass}
          />
        </div>
      </div>

    
      <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
        <div>
          <label className={labelClass}>
            Selling Price (Rs.) *
          </label>

          <input
            type="number"
            name="price"
            value={formData.price}
            onChange={handleChange}
            placeholder="150"
            min="0.01"
            step="0.01"
            className={inputClass}
            required
          />
        </div>

        <div>
          <label className={labelClass}>
            Original Price (Rs.)
          </label>

          <input
            type="number"
            name="originalPrice"
            value={formData.originalPrice}
            onChange={handleChange}
            placeholder="200"
            min="0"
            step="0.01"
            className={inputClass}
          />
        </div>

        <div>
          <label className={labelClass}>
            Available Stock *
          </label>

          <input
            type="number"
            name="stock"
            value={formData.stock}
            onChange={handleChange}
            placeholder="50"
            min="0"
            step="1"
            className={inputClass}
            required
          />
        </div>
      </div>

      
      <ProductImageUpload
        value={formData.image}
        onChange={(file) => setImageFile(file)}
      />

     
      <div>
        <label className={labelClass}>
          Product Description
        </label>

        <textarea
          name="description"
          value={formData.description}
          onChange={handleChange}
          placeholder="Enter product description..."
          rows={4}
          className={inputClass}
        />
      </div>

      
      <div className="flex items-center justify-between rounded-lg border border-gray-200 p-4">
        <div>
          <p className="text-sm font-medium text-gray-800">
            Product Visibility
          </p>

          <p className="mt-1 text-xs text-gray-500">
            Control whether customers can see this product.
          </p>
        </div>

        <label className="flex cursor-pointer items-center gap-2">
          <input
            type="checkbox"
            checked={formData.isVisible}
            onChange={(e) =>
              setFormData((previous) => ({
                ...previous,
                isVisible: e.target.checked,
              }))
            }
            className="h-4 w-4 accent-black"
          />

          <span className="text-sm font-medium text-gray-700">
            Visible
          </span>
        </label>
      </div>

      
      <div className="flex flex-wrap justify-end gap-3 border-t border-gray-200 pt-5">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-gray-300 px-5 py-3 text-sm font-medium text-gray-700 transition hover:bg-gray-100"
        >
          Cancel
        </button>

        <button
          type="submit"
          disabled={availableCategories.length === 0 && !currentCategoryIsHidden}
          className="rounded-lg bg-black px-6 py-3 text-sm font-medium text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {mode === "add" ? "Add Product" : "Save Changes"}
        </button>
      </div>
    </form>
  );
}
