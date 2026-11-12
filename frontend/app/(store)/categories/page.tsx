
"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import Link from "next/link";

import {
  Apple,
  Carrot,
  Milk,
  Croissant,
  Wheat,
  Coffee,
  Cookie,
  ShoppingBasket,
  Search,
  ArrowRight,
  Star,
  SlidersHorizontal,
  PackageSearch,
  X,
} from "lucide-react";

import {
  getCategoriesSnapshot,
  getServerCategoriesSnapshot,
  subscribeToCategories,
} from "@/lib/category-storage";

import {
  getProductsSnapshot,
  getServerProductsSnapshot,
  subscribeToProducts,
} from "@/lib/product-storage";


const nepaliCategoryNames: Record<string, string> = {
  Fruits: "फलफूल",
  Vegetables: "तरकारी",
  Dairy: "दुग्धजन्य पदार्थ",
  Bakery: "बेकरी",
  Groceries: "किराना सामान",
  Beverages: "पेय पदार्थ",
  Snacks: "खाजा तथा स्न्याक्स",
};

const categoryDetails: Record<
  string,
  {
    description: string;
    icon: typeof Apple;
    color: string;
    background: string;
  }
> = {
  Fruits: {
    description: "Fresh, juicy and naturally delicious fruits.",
    icon: Apple,
    color: "#E76F51",
    background: "#FFF0EB",
  },
  Vegetables: {
    description: "Healthy and fresh vegetables for everyday meals.",
    icon: Carrot,
    color: "#279D5E",
    background: "#EAF8EF",
  },
  Dairy: {
    description: "Fresh dairy essentials for your daily nutrition.",
    icon: Milk,
    color: "#4385C5",
    background: "#EDF5FC",
  },
  Bakery: {
    description: "Freshly baked goods made for every occasion.",
    icon: Croissant,
    color: "#C58B35",
    background: "#FFF5E5",
  },
  Groceries: {
    description: "Everyday kitchen essentials and pantry staples.",
    icon: Wheat,
    color: "#9B7A37",
    background: "#F8F2E5",
  },
  Beverages: {
    description: "Refreshing drinks to keep you energized.",
    icon: Coffee,
    color: "#98674C",
    background: "#F7EFEA",
  },
  Snacks: {
    description: "Tasty treats for your little hunger moments.",
    icon: Cookie,
    color: "#C46B9B",
    background: "#FCEEF5",
  },
};

export default function CategoriesPage() {
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [categorySearch, setCategorySearch] = useState("");
  const [productSearch, setProductSearch] = useState("");

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

  const categoryList = useMemo(
    () => categories.filter((category) => category.isVisible),
    [categories]
  );

  const visibleProducts = useMemo(
    () => products.filter((product) => product.isVisible !== false),
    [products]
  );

  const activeCategory =
    selectedCategory === "All" ||
    categoryList.some(
      (category) => category.name === selectedCategory
    )
      ? selectedCategory
      : "All";

  function getNepaliName(categoryName: string) {
    const category = categoryList.find(
      (item) => item.name === categoryName
    );

    return (
      category?.nameNp ||
      nepaliCategoryNames[categoryName] ||
      ""
    );
  }

  const filteredCategories = useMemo(
    () =>
      categoryList.filter(
        (category) =>
          category.name
            .toLowerCase()
            .includes(categorySearch.toLowerCase()) ||
          (category.nameNp ?? "")
            .toLowerCase()
            .includes(categorySearch.toLowerCase())
      ),
    [categoryList, categorySearch]
  );

  const filteredProducts = useMemo(() => {
    return visibleProducts.filter((product) => {
      const matchesCategory =
        activeCategory === "All" ||
        product.category === activeCategory;

      const searchTerm = productSearch.toLowerCase();

      const matchesSearch =
        product.name.toLowerCase().includes(searchTerm) ||
        (product.nameNp ?? "").toLowerCase().includes(searchTerm) ||
        product.description.toLowerCase().includes(searchTerm);

      return matchesCategory && matchesSearch;
    });
  }, [visibleProducts, activeCategory, productSearch]);

  const getCategoryCount = (categoryName: string) =>
    visibleProducts.filter(
      (product) => product.category === categoryName
    ).length;

  const formatPrice = (price: number) =>
    `Rs. ${price.toLocaleString("en-NP")}`;

  const handleCategorySelect = (category: string) => {
    setSelectedCategory(category);
    setProductSearch("");
  };

  return (
    <main className="min-h-screen bg-[#fafafa] text-[#101A17]">
    
      <section className="relative overflow-hidden bg-[#101A17] px-5 py-16 text-white sm:px-8 sm:py-20">
        <div className="pointer-events-none absolute -right-20 -top-32 h-80 w-80 rounded-full bg-[#35C477]/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-40 left-1/3 h-80 w-80 rounded-full bg-[#35C477]/10 blur-3xl" />

        <div className="relative mx-auto max-w-7xl">
          <p className="mb-4 text-xs font-bold uppercase tracking-[0.3em] text-[#35C477]">
            Explore Malta
          </p>

          <div className="flex flex-col justify-between gap-8 md:flex-row md:items-end">
            <div className="max-w-2xl">
              <h1 className="text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
                Shop by
                <span className="text-[#35C477]"> Category.</span>
              </h1>

              <p className="mt-5 max-w-xl text-sm leading-7 text-gray-400 sm:text-base">
                Discover fresh groceries, everyday essentials and
                your favorite products. Find everything you need
                in one convenient place.
              </p>
            </div>

            <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-5 py-4">
              <ShoppingBasket
                size={28}
                className="text-[#35C477]"
              />

              <div>
                <p className="text-2xl font-bold">
                  {visibleProducts.length}+
                </p>

                <p className="text-xs text-gray-400">
                  Products to explore
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-14 sm:px-8 lg:py-20">
        <div className="mb-8 flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-[#279d5e]">
              Browse collections
            </p>

            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
              Explore our categories
              <span className="text-[#35C477]">.</span>
            </h2>

            <p className="mt-2 text-sm text-gray-500">
              Find exactly what you are looking for.
            </p>
          </div>

          <div className="relative w-full sm:max-w-xs">
            <Search
              size={18}
              className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"
            />

            <input
              type="text"
              value={categorySearch}
              onChange={(event) =>
                setCategorySearch(event.target.value)
              }
              placeholder="Search categories..."
              className="h-12 w-full rounded-xl border border-gray-200 bg-white pl-11 pr-10 text-sm outline-none transition focus:border-[#35C477] focus:ring-2 focus:ring-[#35C477]/10"
            />

            {categorySearch && (
              <button
                type="button"
                onClick={() => setCategorySearch("")}
                aria-label="Clear category search"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700"
              >
                <X size={17} />
              </button>
            )}
          </div>
        </div>

        <div className="mb-7 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => handleCategorySelect("All")}
            className={`rounded-full px-5 py-2.5 text-sm font-semibold transition ${
              activeCategory === "All"
                ? "bg-[#101A17] text-white"
                : "border border-gray-200 bg-white text-gray-600 hover:border-[#35C477] hover:text-[#279d5e]"
            }`}
          >
            All Categories
          </button>
        </div>

        {filteredCategories.length > 0 ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
            {filteredCategories.map((category) => {
              const details = categoryDetails[category.name];
              const Icon = details?.icon ?? ShoppingBasket;
              const isSelected =
                activeCategory === category.name;

              return (
                <button
                  key={category.id}
                  type="button"
                  onClick={() =>
                    handleCategorySelect(category.name)
                  }
                  aria-pressed={isSelected}
                  className={`group relative flex min-h-48 flex-col items-center justify-center overflow-hidden rounded-2xl border p-5 text-center transition duration-300 hover:-translate-y-1 hover:shadow-lg ${
                    isSelected
                      ? "border-[#35C477] bg-[#F0FBF4] shadow-md"
                      : "border-gray-100 bg-white hover:border-[#35C477]/50"
                  }`}
                >
                  <div
                    className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl transition duration-300 group-hover:scale-110"
                    style={{
                      backgroundColor:
                        details?.background ?? "#F0F5F1",
                      color: details?.color ?? "#279d5e",
                    }}
                  >
                    <Icon size={30} strokeWidth={1.6} />
                  </div>

                  <h3 className="text-sm font-bold text-[#101A17]">
                    {category.name}
                  </h3>

                  {(category.nameNp ||
                    nepaliCategoryNames[category.name]) && (
                    <p className="mt-1 text-xs font-medium text-[#279d5e]">
                      {category.nameNp ||
                        nepaliCategoryNames[category.name]}
                    </p>
                  )}

                  <p className="mt-1.5 text-xs text-gray-400">
                    {getCategoryCount(category.name)} products
                  </p>

                  <div
                    className={`mt-3 flex items-center gap-1 text-xs font-semibold transition ${
                      isSelected
                        ? "text-[#279d5e]"
                        : "text-gray-400 group-hover:text-[#279d5e]"
                    }`}
                  >
                    Explore
                    <ArrowRight size={13} />
                  </div>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="rounded-2xl border border-gray-100 bg-white px-5 py-12 text-center">
            <Search
              className="mx-auto mb-3 text-gray-300"
              size={30}
            />

            <p className="font-semibold text-[#101A17]">
              No categories found
            </p>

            <p className="mt-2 text-sm text-gray-500">
              Try searching with a different category name.
            </p>
          </div>
        )}
      </section>

      <section
        id="category-products"
        className="border-t border-gray-100 bg-white px-5 py-14 sm:px-8 lg:py-20"
      >
        <div className="mx-auto max-w-7xl">
          <div className="mb-9 flex flex-col justify-between gap-5 md:flex-row md:items-end">
            <div>
              <p className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-[#279d5e]">
                Discover products
              </p>

              <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
                {activeCategory === "All"
                  ? "All Products / सबै सामान"
                  : `${activeCategory} / ${getNepaliName(activeCategory)} Products`}
                <span className="text-[#35C477]">.</span>
              </h2>

              <p className="mt-2 text-sm text-gray-500">
                Showing {filteredProducts.length}{" "}
                {filteredProducts.length === 1
                  ? "product"
                  : "products"}.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <div className="relative w-full sm:w-64">
                <Search
                  size={17}
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"
                />

                <input
                  type="text"
                  value={productSearch}
                  onChange={(event) =>
                    setProductSearch(event.target.value)
                  }
                  placeholder="Search products..."
                  className="h-11 w-full rounded-xl border border-gray-200 bg-[#fafafa] pl-10 pr-4 text-sm outline-none transition focus:border-[#35C477] focus:ring-2 focus:ring-[#35C477]/10"
                />
              </div>

              <button
                type="button"
                onClick={() => {
                  setSelectedCategory("All");
                  setProductSearch("");
                  setCategorySearch("");
                }}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-gray-200 px-4 text-sm font-semibold text-gray-600 transition hover:border-[#35C477] hover:text-[#279d5e]"
              >
                <SlidersHorizontal size={16} />
                Reset Filters
              </button>
            </div>
          </div>

          {filteredProducts.length > 0 ? (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {filteredProducts.map((product) => (
                <Link
                  href={`/products/${product.id}`}
                  key={product.id}
                  className="group overflow-hidden rounded-2xl border border-gray-100 bg-white transition duration-300 hover:-translate-y-1 hover:shadow-lg"
                >
                  <div className="relative aspect-square overflow-hidden bg-[#f5f5f5]">
                    {product.image ? (
  <img
    src={product.image}
    alt={product.name}
    loading="lazy"
    className="block h-full w-full object-cover transition duration-500 group-hover:scale-105"
  />
) : (
  <div className="flex h-full w-full items-center justify-center bg-gray-100">
    <PackageSearch size={40} className="text-gray-400" />
    <span className="sr-only">No product image available</span>
  </div>
)}

                    {product.badge && (
                      <span className="absolute left-3 top-3 rounded-full bg-[#35C477] px-3 py-1 text-[10px] font-bold text-white">
                        {product.badge}
                      </span>
                    )}
                  </div>

                  <div className="p-3 sm:p-4">
                    <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-[#279d5e]">
                      {product.category}
                    </p>

                    <h3 className="line-clamp-1 text-sm font-bold text-[#101A17] transition group-hover:text-[#279d5e] sm:text-base">
                      {product.name}
                    </h3>

                    <p className="mt-1 line-clamp-1 text-xs font-medium text-gray-500">
                      {product.nameNp}
                    </p>

                    <div className="mt-2 flex items-center gap-1 text-xs text-gray-500">
                      <Star
                        size={13}
                        className="fill-amber-400 text-amber-400"
                      />

                      <span className="font-semibold text-[#101A17]">
                        {product.rating}
                      </span>

                      <span>({product.reviews} reviews)</span>
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <span className="text-sm font-bold text-[#279d5e] sm:text-base">
                        {formatPrice(product.price)}
                      </span>

                      {product.originalPrice && (
                        <span className="text-xs text-gray-400 line-through">
                          {formatPrice(product.originalPrice)}
                        </span>
                      )}
                    </div>

                    <div className="mt-4 flex items-center justify-between border-t border-gray-100 pt-3">
                      <span className="text-xs font-semibold text-gray-500">
                        View Details
                      </span>

                      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#EAF8EF] text-[#279d5e] transition group-hover:bg-[#35C477] group-hover:text-white">
                        <ArrowRight size={15} />
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-gray-100 bg-[#fafafa] px-5 py-16 text-center">
              <ShoppingBasket
                size={36}
                className="mx-auto mb-4 text-gray-300"
              />

              <h3 className="text-lg font-bold text-[#101A17]">
                No products found
              </h3>

              <p className="mt-2 text-sm text-gray-500">
                We couldn&apos;t find products matching your search.
              </p>

              <button
                type="button"
                onClick={() => setProductSearch("")}
                className="mt-5 text-sm font-bold text-[#279d5e] hover:underline"
              >
                Clear Search
              </button>
            </div>
          )}
          <div className="mt-12 text-center">
            <Link
              href="/products"
              className="inline-flex items-center gap-2 rounded-xl bg-[#101A17] px-7 py-4 text-sm font-semibold text-white transition hover:bg-[#279d5e]"
            >
              Browse All Products
              <ArrowRight size={17} />
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
