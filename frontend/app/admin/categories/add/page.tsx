
"use client";

import { useEffect } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";

import { useAuth } from "@/context/AuthContext";
import {
  getCategoriesSnapshot,
  saveCategories,
  type AdminCategory,
} from "@/lib/category-storage";

import CategoryForm, {
  type CategoryFormValues,
} from "@/components/admin/categories/CategoryForm";

export default function AddCategoryPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && user?.role !== "admin") {
      router.replace(user ? "/" : "/login");
    }
  }, [user, isLoading, router]);

  function handleAddCategory(values: CategoryFormValues) {
    const existingCategories = getCategoriesSnapshot();

    const duplicate = existingCategories.some(
      (category) =>
        category.name.toLowerCase() === values.name.toLowerCase()
    );

    if (duplicate) {
      alert("A category with this English name already exists.");
      return;
    }

    const newCategory: AdminCategory = {
      id: crypto.randomUUID(),
      name: values.name,
      nameNp: values.nameNp,
      isVisible: values.isVisible,
    };

    saveCategories([...existingCategories, newCategory]);

    alert("Category created successfully!");
    router.push("/admin/categories");
  }

  if (isLoading || user?.role !== "admin") {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-sm text-gray-500">Loading...</p>
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
          Add New Category
        </h1>

        <p className="mt-1 text-sm text-gray-500">
          Create a new category for your Bazaar products.
        </p>
      </div>

      <CategoryForm
        mode="add"
        onSubmit={handleAddCategory}
        onCancel={() => router.push("/admin/categories")}
      />
    </div>
  );
}
