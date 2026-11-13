
"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Search,
  Tag,
  ShoppingBag,
  Percent,
  Sparkles,
  X,
} from "lucide-react";

import { products } from "@/data/products";

export default function OffersPage() {
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [search, setSearch] = useState("");

  
  const offerProducts = useMemo(
    () =>
      products.filter(
        (product) =>
          product.originalPrice !== undefined &&
          product.originalPrice > product.price
      ),
    []
  );

  const offerCategories = useMemo(
    () => [
      "All",
      ...Array.from(
        new Set(offerProducts.map((product) => product.category))
      ),
    ],
    [offerProducts]
  );

  const getDiscount = (originalPrice: number, price: number) =>
    Math.round(((originalPrice - price) / originalPrice) * 100);

  const formatPrice = (price: number) =>
    `Rs. ${price.toLocaleString("en-NP")}`;

  const filteredOffers = useMemo(
    () =>
      offerProducts.filter((product) => {
        const matchesCategory =
          selectedCategory === "All" ||
          product.category === selectedCategory;

        const matchesSearch =
          product.name.toLowerCase().includes(search.toLowerCase()) ||
          (product.nameNp ?? "").includes(search);

        return matchesCategory && matchesSearch;
      }),
    [offerProducts, selectedCategory, search]
  );

  const totalSavings = filteredOffers.reduce(
    (total, product) =>
      total + (product.originalPrice! - product.price),
    0
  );

  return (
    <main className="min-h-screen bg-[#fafafa] text-[#101A17]">

     
      <section className="relative overflow-hidden bg-[#101A17] px-5 py-16 text-white sm:px-8 sm:py-20">
        <div className="pointer-events-none absolute -right-20 -top-28 h-80 w-80 rounded-full bg-[#35C477]/15 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 left-1/3 h-80 w-80 rounded-full bg-[#35C477]/10 blur-3xl" />

        <div className="relative mx-auto max-w-7xl">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-[#35C477]/30 bg-[#35C477]/10 px-4 py-2 text-xs font-bold uppercase tracking-wider text-[#35C477]">
            <Sparkles size={15} />
            Special deals at Malta
          </div>

          <div className="flex flex-col justify-between gap-8 md:flex-row md:items-end">
            <div className="max-w-2xl">
              <h1 className="text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
                Great Deals.
                <br />
                <span className="text-[#35C477]">
                  Better Savings.
                </span>
              </h1>

              <p className="mt-5 max-w-xl text-sm leading-7 text-gray-400 sm:text-base">
                Discover special prices on your everyday essentials.
                Shop your favorites and enjoy more savings with Malta.
              </p>

              <p className="mt-3 text-sm font-medium text-gray-300">
                विशेष छुटमा आफ्ना मनपर्ने सामानहरू किनमेल गर्नुहोस्।
              </p>
            </div>

            <div className="flex items-center gap-4 rounded-2xl border border-white/10 bg-white/5 p-5">
              <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-[#35C477]/15 text-[#35C477]">
                <Percent size={30} />
              </div>

              <div>
                <p className="text-3xl font-bold">
                  {offerProducts.length}
                </p>
                <p className="mt-1 text-xs text-gray-400">
                  Products on offer
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      
      <section className="mx-auto max-w-7xl px-5 py-14 sm:px-8 lg:py-20">

        
        <div className="mb-8">
          <p className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-[#279d5e]">
            Limited price specials
          </p>

          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
            Explore our offers
            <span className="text-[#35C477]">.</span>
          </h2>

          <p className="mt-2 text-sm text-gray-500">
            Find your favorite products at special prices.
          </p>
        </div>

        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full sm:max-w-sm">
            <Search
              size={18}
              className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"
            />

            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search offers..."
              className="h-12 w-full rounded-xl border border-gray-200 bg-white pl-11 pr-10 text-sm outline-none transition focus:border-[#35C477] focus:ring-2 focus:ring-[#35C477]/10"
            />

            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                aria-label="Clear search"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700"
              >
                <X size={17} />
              </button>
            )}
          </div>

          <p className="text-sm text-gray-500">
            Showing{" "}
            <span className="font-bold text-[#101A17]">
              {filteredOffers.length}
            </span>{" "}
            offers
          </p>
        </div>

        <div className="mb-9 flex gap-2 overflow-x-auto pb-2">
          {offerCategories.map((category) => (
            <button
              key={category}
              type="button"
              onClick={() => setSelectedCategory(category)}
              aria-pressed={selectedCategory === category}
              className={`shrink-0 rounded-full px-5 py-2.5 text-sm font-semibold transition ${
                selectedCategory === category
                  ? "bg-[#101A17] text-white"
                  : "border border-gray-200 bg-white text-gray-600 hover:border-[#35C477] hover:text-[#279d5e]"
              }`}
            >
              {category === "All" ? "All Offers" : category}
            </button>
          ))}
        </div>

        {filteredOffers.length > 0 ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {filteredOffers.map((product) => {
              const discount = getDiscount(
                product.originalPrice!,
                product.price
              );

              return (
                <Link
                  href={`/products/${product.id}`}
                  key={product.id}
                  className="group overflow-hidden rounded-2xl border border-gray-100 bg-white transition duration-300 hover:-translate-y-1 hover:shadow-lg"
                >
                  <div className="relative aspect-square overflow-hidden bg-[#f5f5f5]">
                    <img
                      src={product.image}
                      alt={product.name}
                      loading="lazy"
                      className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                    />

                    <span className="absolute left-3 top-3 flex items-center gap-1 rounded-full bg-[#E84B4B] px-3 py-1.5 text-[11px] font-bold text-white shadow-sm">
                      <Tag size={12} />
                      {discount}% OFF
                    </span>
                  </div>

                  <div className="p-3 sm:p-4">
                    <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-[#279d5e]">
                      {product.category}
                    </p>

                    <h3 className="line-clamp-1 text-sm font-bold text-[#101A17] transition group-hover:text-[#279d5e] sm:text-base">
                      {product.name}
                    </h3>

                    <p className="mt-1 line-clamp-1 text-xs font-medium text-gray-500">
                      {product.nameNp ?? ""}
                    </p>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <span className="text-sm font-bold text-[#279d5e] sm:text-base">
                        {formatPrice(product.price)}
                      </span>

                      <span className="text-xs text-gray-400 line-through">
                        {formatPrice(product.originalPrice!)}
                      </span>
                    </div>

                    <p className="mt-2 text-xs font-semibold text-[#E84B4B]">
                      You save{" "}
                      {formatPrice(
                        product.originalPrice! - product.price
                      )}
                    </p>

                    <div className="mt-4 flex items-center justify-between border-t border-gray-100 pt-3">
                      <span className="text-xs font-semibold text-gray-500">
                        View Product
                      </span>

                      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#EAF8EF] text-[#279d5e] transition group-hover:bg-[#35C477] group-hover:text-white">
                        <ArrowRight size={15} />
                      </span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="rounded-2xl border border-gray-100 bg-white px-5 py-16 text-center">
            <ShoppingBag
              size={36}
              className="mx-auto mb-4 text-gray-300"
            />

            <h3 className="text-lg font-bold">
              No offers found
            </h3>

            <p className="mt-2 text-sm text-gray-500">
              Try another search or category.
            </p>

            <button
              type="button"
              onClick={() => {
                setSearch("");
                setSelectedCategory("All");
              }}
              className="mt-5 text-sm font-bold text-[#279d5e] hover:underline"
            >
              Reset Filters
            </button>
          </div>
        )}

        {filteredOffers.length > 0 && (
          <div className="mt-12 flex flex-col justify-between gap-4 rounded-2xl bg-[#EAF8EF] p-6 sm:flex-row sm:items-center sm:p-8">
            <div>
              <p className="text-sm font-semibold text-[#279d5e]">
                More value with Malta
              </p>

              <h3 className="mt-1 text-xl font-bold text-[#101A17]">
                Save on your everyday shopping.
              </h3>

              <p className="mt-2 text-sm text-gray-600">
                Total potential savings across these offers:
              </p>
            </div>

            <div className="text-left sm:text-right">
              <p className="text-2xl font-bold text-[#279d5e]">
                {formatPrice(totalSavings)}
              </p>
              <p className="mt-1 text-xs text-gray-500">
                If you purchase one of each displayed offer
              </p>
            </div>
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
      </section>
    </main>
  );
}
