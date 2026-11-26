"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";

import {
  ArrowRight,
  ArrowUpRight,
  Search,
  X,
  PackageSearch,
  ShoppingBag,
  Sparkles,
} from "lucide-react";

import { useGSAP } from "@gsap/react";
import gsap from "gsap";

import { useCategories } from "@/hooks/useCategories";
import { useProducts } from "@/hooks/useProducts";

export default function CategoriesPage() {
  const categories = useCategories();
  const products = useProducts();

  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");

  const pageRef = useRef<HTMLDivElement>(null);
  const productsSectionRef = useRef<HTMLElement>(null);

  
  const visibleCategories = useMemo(
    () => categories.filter((category) => category.isVisible),
    [categories]
  );

  
  const visibleProducts = useMemo(
    () => products.filter((product) => product.isVisible !== false),
    [products]
  );

  const normalizedSearch = search.trim().toLowerCase();

  
  const activeCategory =
    selectedCategory === "All" ||
    visibleCategories.some(
      (category) => category.name === selectedCategory
    )
      ? selectedCategory
      : "All";

  
  const filteredCategories = useMemo(() => {
    if (!normalizedSearch) return visibleCategories;

    return visibleCategories.filter((category) => {
      return (
        category.name.toLowerCase().includes(normalizedSearch) ||
        (category.nameNp ?? "").toLowerCase().includes(normalizedSearch)
      );
    });
  }, [visibleCategories, normalizedSearch]);

  
  const filteredProducts = useMemo(() => {
    let result = visibleProducts;

    if (activeCategory !== "All") {
      result = result.filter(
        (product) => product.category === activeCategory
      );
    }

    if (normalizedSearch) {
      result = result.filter((product) => {
        return (
          product.name.toLowerCase().includes(normalizedSearch) ||
          (product.nameNp ?? "").toLowerCase().includes(normalizedSearch) ||
          product.category.toLowerCase().includes(normalizedSearch)
        );
      });
    }

    return result;
  }, [visibleProducts, activeCategory, normalizedSearch]);

  
  useGSAP(
    () => {
      if (!pageRef.current) return;

      const timeline = gsap.timeline();

      timeline
        .fromTo(
          ".categories-eyebrow",
          { y: 20, opacity: 0 },
          {
            y: 0,
            opacity: 1,
            duration: 0.6,
            ease: "power3.out",
          }
        )
        .fromTo(
          ".categories-heading",
          { y: 35, opacity: 0 },
          {
            y: 0,
            opacity: 1,
            duration: 0.8,
            ease: "power3.out",
          },
          "-=0.35"
        )
        .fromTo(
          ".categories-description",
          { y: 20, opacity: 0 },
          {
            y: 0,
            opacity: 1,
            duration: 0.6,
            ease: "power3.out",
          },
          "-=0.45"
        )
        .fromTo(
          ".category-card",
          { y: 30, opacity: 0 },
          {
            y: 0,
            opacity: 1,
            duration: 0.6,
            stagger: 0.08,
            ease: "power3.out",
          },
          "-=0.25"
        );
    },
    {
      scope: pageRef,
      dependencies: [filteredCategories.length],
    }
  );

  
  const getCategoryCount = (categoryName: string) =>
    visibleProducts.filter(
      (product) => product.category === categoryName
    ).length;

  
  const getCategoryImage = (categoryName: string) =>
    visibleProducts.find(
      (product) =>
        product.category === categoryName && Boolean(product.image)
    )?.image;

 
  const handleCategorySelect = (categoryName: string) => {
    setSelectedCategory(categoryName);
    setSearch("");

    productsSectionRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  };

  return (
    <main
      ref={pageRef}
      className="min-h-screen bg-[#F8F8F4] text-[#17231E]"
    >
      

      <section className="mx-auto max-w-7xl px-5 py-16 sm:px-8 sm:py-20">
        <div className="mb-9 flex flex-col justify-between gap-6 md:flex-row md:items-end">
          <div>
            <p className="mb-3 text-xs font-bold uppercase tracking-[0.2em] text-[#77913E]">
              Browse collections
            </p>

            <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              Shop by category
            </h2>

            <p className="mt-3 max-w-xl text-sm leading-6 text-[#68736D]">
              Find exactly what you are looking for from our product
              collections.
            </p>
          </div>

          <div className="relative w-full md:max-w-sm">
            <Search
              size={18}
              className="absolute left-4 top-1/2 -translate-y-1/2 text-[#87918B]"
            />

            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search categories or products..."
              className="h-12 w-full rounded-full border border-[#E3E7DF] bg-white pl-11 pr-11 text-sm outline-none transition focus:border-[#829D4C]"
            />

            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                aria-label="Clear search"
                className="absolute right-4 top-1/2 -translate-y-1/2 text-[#87918B] hover:text-[#17231E]"
              >
                <X size={17} />
              </button>
            )}
          </div>
        </div>

        {filteredCategories.length > 0 ? (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {filteredCategories.map((category) => {
              const image = getCategoryImage(category.name);
              const count = getCategoryCount(category.name);
              const isSelected = activeCategory === category.name;

              return (
                <button
                  type="button"
                  key={category.id}
                  onClick={() =>
                    handleCategorySelect(
                      isSelected ? "All" : category.name
                    )
                  }
                  aria-pressed={isSelected}
                  className={`category-card group overflow-hidden rounded-2xl border bg-white text-left transition duration-300 hover:-translate-y-1 hover:shadow-xl ${
                    isSelected
                      ? "border-[#829D4C] ring-2 ring-[#829D4C]/20"
                      : "border-[#E9ECE5]"
                  }`}
                >
                  <div className="relative flex h-52 items-center justify-center overflow-hidden bg-[#E9EDE4]">
                    {image ? (
                      <Image
                        src={image}
                        alt={category.name}
                        fill
                        unoptimized
                        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                        className="object-cover transition duration-700 group-hover:scale-105"
                      />
                    ) : (
                      <div className="flex h-full w-full flex-col items-center justify-center gap-3 bg-[#E9EDE4]">
                        <span className="text-6xl">🛍️</span>

                        <span className="text-xs font-medium uppercase tracking-[0.15em] text-[#75816F]">
                          {category.name}
                        </span>
                      </div>
                    )}

                    <div className="absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-transparent" />

                    <span className="absolute bottom-4 left-5 rounded-full bg-white/90 px-3 py-1.5 text-xs font-semibold text-[#17231E]">
                      {count} {count === 1 ? "product" : "products"}
                    </span>

                    <span className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-white text-[#17231E] transition group-hover:bg-[#B7D96C]">
                      <ArrowUpRight size={19} />
                    </span>
                  </div>
                  <div className="p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h3 className="text-xl font-semibold">
                          {category.name}
                        </h3>

                        {category.nameNp && (
                          <p className="mt-1 text-sm text-[#829078]">
                            {category.nameNp}
                          </p>
                        )}
                      </div>

                      {isSelected && (
                        <span className="rounded-full bg-[#EAF1DC] px-3 py-1 text-xs font-semibold text-[#607A34]">
                          Selected
                        </span>
                      )}
                    </div>

                    <p className="mt-3 min-h-10 text-sm leading-5 text-[#748078]">
                      Explore our collection of{" "}
                      {category.name.toLowerCase()} products.
                    </p>

                    <div className="mt-5 flex items-center justify-between border-t border-[#EEF0EA] pt-4 text-sm font-semibold">
                      <span className="text-[#607A34]">
                        {isSelected
                          ? "Show all products"
                          : "Explore category"}
                      </span>

                      <ArrowRight
                        size={17}
                        className="text-[#607A34] transition group-hover:translate-x-1"
                      />
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-[#D9DFD4] bg-white px-6 py-16 text-center">
            <PackageSearch
              size={38}
              className="mx-auto text-[#9AA695]"
            />

            <h3 className="mt-4 text-xl font-semibold">
              No categories found
            </h3>

            <p className="mt-2 text-sm text-[#748078]">
              Try another search or clear your search field.
            </p>

            <button
              type="button"
              onClick={() => setSearch("")}
              className="mt-5 rounded-full bg-[#17231E] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#33483B]"
            >
              Clear search
            </button>
          </div>
        )}
      </section>

      <section
        ref={productsSectionRef}
        id="category-products"
        className="scroll-mt-24 bg-white px-5 py-16 sm:px-8 sm:py-20"
      >
        <div className="mx-auto max-w-7xl">
          <div className="mb-9 flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
            <div>
              <p className="mb-3 text-xs font-bold uppercase tracking-[0.2em] text-[#77913E]">
                Discover our products
              </p>

              <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                {activeCategory === "All"
                  ? "Explore products"
                  : activeCategory}
              </h2>

              <p className="mt-3 text-sm text-[#748078]">
                {filteredProducts.length} products available
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => handleCategorySelect("All")}
                className={`rounded-full px-5 py-2.5 text-sm font-semibold transition ${
                  activeCategory === "All"
                    ? "bg-[#17231E] text-white"
                    : "bg-[#F1F3ED] text-[#526057] hover:bg-[#E5EADF]"
                }`}
              >
                All products
              </button>

              {visibleCategories.slice(0, 4).map((category) => (
                <button
                  type="button"
                  key={category.id}
                  onClick={() => handleCategorySelect(category.name)}
                  className={`rounded-full px-5 py-2.5 text-sm font-semibold transition ${
                    activeCategory === category.name
                      ? "bg-[#17231E] text-white"
                      : "bg-[#F1F3ED] text-[#526057] hover:bg-[#E5EADF]"
                  }`}
                >
                  {category.name}
                </button>
              ))}
            </div>
          </div>

          {filteredProducts.length > 0 ? (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {filteredProducts.slice(0, 8).map((product) => (
                <Link
                  href={`/products/${product.id}`}
                  key={product.id}
                  className="group overflow-hidden rounded-2xl border border-[#E9ECE5] bg-[#FDFDFB] transition duration-300 hover:-translate-y-1 hover:shadow-lg"
                >
                  <div className="relative flex aspect-square items-center justify-center overflow-hidden bg-[#F0F2EC]">
                    {product.image ? (
                      <Image
                        src={product.image}
                        alt={product.name}
                        fill
                        unoptimized
                        sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                        className="object-cover transition duration-500 group-hover:scale-105"
                      />
                    ) : (
                      <ShoppingBag
                        size={38}
                        className="text-[#A5B09E]"
                      />
                    )}
                  </div>

                 
                  <div className="p-4">
                    <p className="text-xs font-medium text-[#829078]">
                      {product.category}
                    </p>

                    <h3 className="mt-1 line-clamp-2 min-h-10 text-sm font-semibold text-[#17231E]">
                      {product.name}
                    </h3>

                    {product.nameNp && (
                      <p className="mt-1 line-clamp-1 text-xs text-[#829078]">
                        {product.nameNp}
                      </p>
                    )}

                    <div className="mt-3 flex items-center justify-between gap-2">
                      <span className="font-semibold text-[#607A34]">
                        Rs. {product.price.toLocaleString("en-NP")}
                      </span>

                      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#EAF1DC] text-[#607A34] transition group-hover:bg-[#B7D96C]">
                        <ArrowUpRight size={16} />
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl bg-[#F8F8F4] px-6 py-16 text-center">
              <PackageSearch
                size={38}
                className="mx-auto text-[#9AA695]"
              />

              <h3 className="mt-4 text-xl font-semibold">
                No products available
              </h3>

              <p className="mt-2 text-sm text-[#748078]">
                There are currently no visible products in this category.
              </p>

              <button
                type="button"
                onClick={() => handleCategorySelect("All")}
                className="mt-5 rounded-full bg-[#17231E] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#33483B]"
              >
                View all products
              </button>
            </div>
          )}

          {filteredProducts.length > 8 && (
            <div className="mt-10 text-center">
              <Link
                href="/products"
                className="inline-flex items-center gap-3 rounded-full bg-[#17231E] px-7 py-3.5 text-sm font-semibold text-white transition hover:bg-[#33483B]"
              >
                View all products
                <ArrowRight size={17} />
              </Link>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}