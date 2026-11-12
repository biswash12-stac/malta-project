
"use client";

import { useEffect } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useSyncExternalStore } from "react";

import { useAuth } from "@/context/AuthContext";

import {
  getProductsSnapshot,
  saveProducts,
} from "@/lib/product-storage";

import {
  getCategoriesSnapshot,
  getServerCategoriesSnapshot,
  subscribeToCategories,
  saveCategories,
} from "@/lib/category-storage";

import CategoryForm, {
  type CategoryFormValues,
} from "@/components/admin/categories/CategoryForm";

export default function EditCategoryPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const params = useParams();

  const categoryId = params.id as string;

  const categories = useSyncExternalStore(
    subscribeToCategories,
    getCategoriesSnapshot,
    getServerCategoriesSnapshot
  );

  const category = categories.find(
    (item) => item.id === categoryId
  );

  useEffect(() => {
    if (!isLoading && user?.role !== "admin") {
      router.replace(user ? "/" : "/login");
    }
  }, [user, isLoading, router]);

  
function handleUpdateCategory(values: CategoryFormValues) {
  if (!category) return;

  const duplicate = categories.some(
    (item) =>
      item.id !== category.id &&
      item.name.toLowerCase() === values.name.toLowerCase()
  );

  if (duplicate) {
    alert("Another category already uses this English name.");
    return;
  }

  const updatedCategories = categories.map((item) =>
    item.id === category.id
      ? {
          ...item,
          name: values.name,
          nameNp: values.nameNp,
          isVisible: values.isVisible,
        }
      : item
  );

  if (category.name !== values.name) {
    const existingProducts = getProductsSnapshot();

    const updatedProducts = existingProducts.map((product) =>
      product.category === category.name
        ? {
            ...product,
            category: values.name,
          }
        : product
    );

    saveProducts(updatedProducts);
  }

  saveCategories(updatedCategories);

  alert("Category updated successfully!");
  router.push("/admin/categories");
}


  if (isLoading || user?.role !== "admin") {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-sm text-gray-500">Loading...</p>
      </div>
    );
  }

  if (!category) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold text-gray-900">
          Category Not Found
        </h1>

        <p className="text-sm text-gray-500">
          {`The category you're trying to edit does not exist.`}
        </p>

        <Link
          href="/admin/categories"
          className="inline-flex items-center gap-2 text-sm font-semibold text-black hover:underline"
        >
          <ArrowLeft size={17} />
          Back to Categories
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link
          href="/admin/categories"
          className="mb-4 inline-flex items-center gap-2 text-sm font-medium text-gray-500 transition hover:text-black"
        >
          <ArrowLeft size={17} />
          Back to Categories
        </Link>

        <h1 className="text-2xl font-bold text-gray-900">
          Edit Category
        </h1>

        <p className="mt-1 text-sm text-gray-500">
          Update the category information and visibility.
        </p>
      </div>

      <CategoryForm
        mode="edit"
        initialData={category}
        onSubmit={handleUpdateCategory}
        onCancel={() => router.push("/admin/categories")}
      />
    </div>
  );
}
