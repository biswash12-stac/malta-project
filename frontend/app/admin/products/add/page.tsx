
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, PackagePlus } from "lucide-react";

import ProductForm, {
  type ProductFormValues,
} from "@/components/admin/products/ProductForm";

import { useAuth } from "@/context/AuthContext";

import {
  getProductsSnapshot,
  saveProducts,
  type AdminProduct,
} from "@/lib/product-storage";

export default function AddProductPage() {
  const router = useRouter();
  const { user, isLoading } = useAuth();


  useEffect(() => {
    if (!isLoading && (!user || user.role !== "admin")) {
      router.replace(user ? "/" : "/login");
    }
  }, [user, isLoading, router]);

  function handleAddProduct(values: ProductFormValues) {
    const newProduct: AdminProduct = {
      id: Date.now(),
      name: values.name.trim(),
      nameNp: values.nameNp.trim(),
      category: values.category,
      price: Number(values.price),
      originalPrice: values.originalPrice
        ? Number(values.originalPrice)
        : undefined,
      stock: Number(values.stock),
      image: values.image.trim(),
      description: values.description.trim(),
      badge: values.badge.trim() || undefined,
      isVisible: values.isVisible,
      rating: 5,
      reviews: 0,
      popular: 0,
    };

    const existingProducts = getProductsSnapshot();

    saveProducts([...existingProducts, newProduct]);

    alert("Product added successfully!");

    router.push("/admin/products");
  }

  if (isLoading || !user || user.role !== "admin") {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-sm text-gray-500">Loading...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
    
      <div>
        <Link
          href="/admin/products"
          className="mb-4 inline-flex items-center gap-2 text-sm text-gray-500 transition hover:text-black"
        >
          <ArrowLeft size={16} />
          Back to Products
        </Link>

        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gray-100">
            <PackagePlus size={24} className="text-gray-800" />
          </div>

          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Add New Product
            </h1>

            <p className="mt-1 text-sm text-gray-500">
              Add a new product to your Malta store.
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm md:p-8">
        <ProductForm
          mode="add"
          onSubmit={handleAddProduct}
          onCancel={() => router.push("/admin/products")}
        />
      </div>
    </div>
  );
}
