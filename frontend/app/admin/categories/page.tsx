
"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import {
  Plus,
  Search,
  Pencil,
  Trash2,
  Eye,
  EyeOff,
  Tags,
  CheckCircle,
  AlertCircle,
} from "lucide-react";

import { useAuth } from "@/context/AuthContext";
import {
  getCategoriesSnapshot,
  getServerCategoriesSnapshot,
  subscribeToCategories,
  saveCategories,
  type AdminCategory,
} from "@/lib/category-storage";

import {
  getProductsSnapshot,
  getServerProductsSnapshot,
  subscribeToProducts,
  saveProducts,
} from "@/lib/product-storage";

import DeleteCategoryDialog from "@/components/admin/categories/DeleteCategoryDialog";
export default function CategoriesPage() {
  const { user, isLoading } = useAuth();

  const categories = useSyncExternalStore(
    subscribeToCategories,
    getCategoriesSnapshot,
    getServerCategoriesSnapshot
  );

  const products = useSyncExternalStore(
    subscribeToProducts,
    getProductsSnapshot,
    getServerProductsSnapshot
  );

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "visible" | "hidden">("all");
  const [selectedCategory, setSelectedCategory] =
    useState<AdminCategory | null>(null);

  useEffect(() => {
    if (!isLoading && user?.role !== "admin") {
      window.location.href = user ? "/" : "/login";
    }
  }, [user, isLoading]);

  const filteredCategories = useMemo(() => {
    return categories.filter((category) => {
      const matchesSearch =
        category.name.toLowerCase().includes(search.toLowerCase()) ||
        category.nameNp.toLowerCase().includes(search.toLowerCase());

      const matchesFilter =
        filter === "all" ||
        (filter === "visible" && category.isVisible) ||
        (filter === "hidden" && !category.isVisible);

      return matchesSearch && matchesFilter;
    });
  }, [categories, search, filter]);

  const visibleCount = categories.filter((c) => c.isVisible).length;
  const hiddenCount = categories.length - visibleCount;

  function getProductCount(categoryName: string) {
    return products.filter(
      (product) => product.category === categoryName
    ).length;
  }

  function handleToggleVisibility(category: AdminCategory) {
    const updated = categories.map((item) =>
      item.id === category.id
        ? { ...item, isVisible: !item.isVisible }
        : item
    );

    saveCategories(updated);
  }

  function handleDeleteCategory() {
    if (!selectedCategory) return;

    const assignedProducts = getProductCount(selectedCategory.name);

    if (assignedProducts > 0) {
      alert(
        `Cannot delete this category because ${assignedProducts} product(s) are assigned to it. Move those products to another category first.`
      );
      setSelectedCategory(null);
      return;
    }

    saveCategories(
      categories.filter((category) => category.id !== selectedCategory.id)
    );

    setSelectedCategory(null);
  }

  if (isLoading || user?.role !== "admin") {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-sm text-gray-500">Loading categories...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 px-0 sm:px-4 lg:px-8">
     
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Categories
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage your product categories and their visibility.
          </p>
        </div>

        <Link
          href="/admin/categories/add"
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-black px-5 py-3 text-sm font-semibold text-white transition hover:bg-gray-800"
        >
          <Plus size={18} />
          Add Category
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">Total Categories</p>
            <Tags className="text-gray-400" size={20} />
          </div>
          <p className="mt-3 text-3xl font-bold text-gray-900">
            {categories.length}
          </p>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">Visible Categories</p>
            <CheckCircle className="text-green-600" size={20} />
          </div>
          <p className="mt-3 text-3xl font-bold text-gray-900">
            {visibleCount}
          </p>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">Hidden Categories</p>
            <AlertCircle className="text-orange-500" size={20} />
          </div>
          <p className="mt-3 text-3xl font-bold text-gray-900">
            {hiddenCount}
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-4 rounded-xl border border-gray-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-sm">
          <Search
            size={18}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
          />
          <input
            type="text"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search English or Nepali name..."
            className="w-full rounded-lg border border-gray-200 py-2.5 pl-10 pr-4 text-sm outline-none focus:border-black"
          />
        </div>

        <div className="flex gap-2">
          {(["all", "visible", "hidden"] as const).map((item) => (
            <button
              key={item}
              onClick={() => setFilter(item)}
              className={`rounded-lg px-4 py-2 text-sm font-medium capitalize transition ${
                filter === item
                  ? "bg-black text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {item}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[750px] text-left">
            <thead className="bg-gray-50">
              <tr className="text-xs uppercase tracking-wide text-gray-500">
                <th className="px-6 py-4">Category</th>
                <th className="px-6 py-4">Nepali Name</th>
                <th className="px-6 py-4">Products</th>
                <th className="px-6 py-4">Visibility</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-100">
              {filteredCategories.map((category) => (
                <tr key={category.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <p className="font-semibold text-gray-900">
                      {category.name}
                    </p>
                  </td>

                  <td className="px-6 py-4 text-sm text-gray-600">
                    {category.nameNp || "—"}
                  </td>

                  <td className="px-6 py-4 text-sm text-gray-600">
                    {getProductCount(category.name)}
                  </td>

                  <td className="px-6 py-4">
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-medium ${
                        category.isVisible
                          ? "bg-green-50 text-green-700"
                          : "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {category.isVisible ? "Visible" : "Hidden"}
                    </span>
                  </td>

                  <td className="px-6 py-4">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => handleToggleVisibility(category)}
                        title={
                          category.isVisible ? "Hide category" : "Show category"
                        }
                        className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-black"
                      >
                        {category.isVisible ? (
                          <EyeOff size={17} />
                        ) : (
                          <Eye size={17} />
                        )}
                      </button>

                      <Link
                        href={`/admin/categories/${category.id}/edit`}
                        title="Edit category"
                        className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-black"
                      >
                        <Pencil size={17} />
                      </Link>

                      <button
                        type="button"
                        onClick={() => setSelectedCategory(category)}
                        title="Delete category"
                        className="rounded-lg p-2 text-red-500 hover:bg-red-50"
                      >
                        <Trash2 size={17} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}

              {filteredCategories.length === 0 && (
                <tr>
                  <td
                    colSpan={5}
                    className="px-6 py-12 text-center text-sm text-gray-500"
                  >
                    No categories found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <DeleteCategoryDialog
        isOpen={!!selectedCategory}
        categoryName={selectedCategory?.name ?? ""}
        onCancel={() => setSelectedCategory(null)}
        onConfirm={handleDeleteCategory}
      />
    </div>
  );
}
