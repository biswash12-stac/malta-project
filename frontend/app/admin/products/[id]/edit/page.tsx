
"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Pencil } from "lucide-react";
import { useSyncExternalStore } from "react";

import ProductForm, {
  type ProductFormValues,
} from "@/components/admin/products/ProductForm";

import { useAuth } from "@/context/AuthContext";

import {
  getProductsSnapshot,
  getServerProductsSnapshot,
  subscribeToProducts,
  saveProducts,
} from "@/lib/product-storage";

export default function EditProductPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const productId = params.id;

  const { user, isLoading } = useAuth();

  
  const products = useSyncExternalStore(
    subscribeToProducts,
    getProductsSnapshot,
    getServerProductsSnapshot
  );


  const product = products.find(
    (item) => String(item.id) === productId
  );

 
  useEffect(() => {
    if (!isLoading && (!user || user.role !== "admin")) {
      router.replace(user ? "/" : "/login");
    }
  }, [user, isLoading, router]);

  function handleUpdateProduct(values: ProductFormValues) {
    if (!product) return;

    const updatedProduct = {
      ...product,
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
    };

    const updatedProducts = products.map((item) =>
      String(item.id) === productId ? updatedProduct : item
    );

    saveProducts(updatedProducts);

    alert("Product updated successfully!");

    router.push("/admin/products");
  }

  if (isLoading || !user || user.role !== "admin") {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-sm text-gray-500">Loading...</p>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="space-y-4">
        <Link
          href="/admin/products"
          className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-black"
        >
          <ArrowLeft size={16} />
          Back to Products
        </Link>

        <div className="rounded-xl border border-gray-200 bg-white p-8 text-center">
          <h2 className="text-xl font-semibold text-gray-900">
            Product Not Found
          </h2>

          <p className="mt-2 text-sm text-gray-500">
            The product you are trying to edit does not exist.
          </p>
        </div>
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
            <Pencil size={23} className="text-gray-800" />
          </div>

          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Edit Product
            </h1>

            <p className="mt-1 text-sm text-gray-500">
              Update product information for your Malta store.
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm md:p-8">
        <ProductForm
          key={product.id}
          mode="edit"
          initialData={product}
          onSubmit={handleUpdateProduct}
          onCancel={() => router.push("/admin/products")}
        />
      </div>
    </div>
  );
}
