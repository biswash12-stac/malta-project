
"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import {
  Search,
  Heart,
  ShoppingCart,
  SlidersHorizontal,
  X,
  ChevronDown,
  Star,
  ArrowUpDown,
  PackageSearch,
  ShoppingBag,
} from "lucide-react";

import {
  type CartItem,
  getCart,
  saveCart,
  getCartCount,
  getWishlist,
  getWishlistSnapshot,
  getEmptyWishlistSnapshot,
  saveWishlist,
  subscribeToShopStorage,
} from "@/lib/shop-storage";

import { categories } from "@/data/products";
import { useProducts } from "@/hooks/useProducts";

const ITEMS_PER_PAGE = 8;
const DEFAULT_MAX_PRICE = 1000;

type SortOption =
  | "popular"
  | "rating"
  | "price-low"
  | "price-high"
  | "name";

export default function ProductsPage() {
  
  const products = useProducts();

  
  const visibleProducts = useMemo(
    () => products.filter((product) => product.isVisible !== false),
    [products]
  );

  
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [sortBy, setSortBy] = useState<SortOption>("popular");
  const [maxPrice, setMaxPrice] = useState(DEFAULT_MAX_PRICE);

  
  const [currentPage, setCurrentPage] = useState(1);
  const [showFilters, setShowFilters] = useState(false);
  const [message, setMessage] = useState("");

  
  const wishlist = useSyncExternalStore(
    subscribeToShopStorage,
    getWishlistSnapshot,
    getEmptyWishlistSnapshot
  );

  const cartCount = useSyncExternalStore(
    subscribeToShopStorage,
    getCartCount,
    () => 0
  );

  
  const showMessage = (text: string) => {
    setMessage(text);

    window.setTimeout(() => {
      setMessage("");
    }, 2500);
  };

  
  const filteredProducts = useMemo(() => {
    let result = [...visibleProducts];

    const query = search.trim().toLowerCase();

    if (query) {
      result = result.filter((product) => {
        return (
          product.name.toLowerCase().includes(query) ||
          (product.nameNp || "").toLowerCase().includes(query) ||
          product.category.toLowerCase().includes(query) ||
          product.description.toLowerCase().includes(query)
        );
      });
    }

    if (selectedCategory !== "All") {
      result = result.filter(
        (product) => product.category === selectedCategory
      );
    }

    result = result.filter(
      (product) => product.price <= maxPrice
    );

    switch (sortBy) {
      case "price-low":
        result.sort((a, b) => a.price - b.price);
        break;

      case "price-high":
        result.sort((a, b) => b.price - a.price);
        break;

      case "rating":
        result.sort((a, b) => b.rating - a.rating);
        break;

      case "name":
        result.sort((a, b) =>
          a.name.localeCompare(b.name)
        );
        break;

      default:
        result.sort((a, b) => b.popular - a.popular);
        break;
    }

    return result;
  }, [
    visibleProducts,
    search,
    selectedCategory,
    maxPrice,
    sortBy,
  ]);

  
  const totalPages = Math.ceil(
    filteredProducts.length / ITEMS_PER_PAGE
  );

  const visiblePageProducts = filteredProducts.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  
  const toggleWishlist = (productId: number) => {
    const currentWishlist = getWishlist();

    const updatedWishlist = currentWishlist.includes(productId)
      ? currentWishlist.filter((id) => id !== productId)
      : [...currentWishlist, productId];

    const saved = saveWishlist(updatedWishlist);

    if (!saved) {
      showMessage("Unable to save your wishlist.");
    } else {
      showMessage(
        updatedWishlist.includes(productId)
          ? "Added to wishlist!"
          : "Removed from wishlist."
      );
    }
  };

  
  const addToCart = (product: (typeof visibleProducts)[number]) => {
    const currentCart = getCart();

    const existingItem = currentCart.find(
      (item) => item.id === product.id
    );

    let updatedCart: CartItem[];

    if (existingItem) {
      updatedCart = currentCart.map((item) =>
        item.id === product.id
          ? {
            ...item,
            quantity: item.quantity + 1,
          }
          : item
      );
    } else {
      updatedCart = [
        ...currentCart,
        {
          id: product.id,
          name: product.name,
          price: product.price,
          image: product.image,
          quantity: 1,
        },
      ];
    }

    const saved = saveCart(updatedCart);

    if (!saved) {
      showMessage("Unable to add this product to your cart.");
      return;
    }

    showMessage(`${product.name} added to cart!`);
  };

 
  const clearFilters = () => {
    setSearch("");
    setSelectedCategory("All");
    setMaxPrice(DEFAULT_MAX_PRICE);
    setSortBy("popular");
    setCurrentPage(1);
  };

  
  const handleSearch = (value: string) => {
    setSearch(value);
    setCurrentPage(1);
  };

  const handleCategory = (category: string) => {
    setSelectedCategory(category);
    setCurrentPage(1);
  };

  const handleSort = (value: SortOption) => {
    setSortBy(value);
    setCurrentPage(1);
  };

  const handlePrice = (value: number) => {
    setMaxPrice(value);
    setCurrentPage(1);
  };

 
  const safeCurrentPage = Math.min(
    currentPage,
    Math.max(totalPages, 1)
  );

  const pageProducts = filteredProducts.slice(
    (safeCurrentPage - 1) * ITEMS_PER_PAGE,
    safeCurrentPage * ITEMS_PER_PAGE
  );

  return (
    <main className="min-h-screen bg-[#fafafa] text-[#171717]">
      
      <section className="bg-[#101A17] px-5 py-14 text-white sm:px-8 sm:py-20">
        <div className="mx-auto max-w-7xl">
          <p className="mb-4 text-xs font-semibold uppercase tracking-[0.3em] text-[#35C477]">
            Discover something fresh
          </p>

          <div className="flex flex-col justify-between gap-8 md:flex-row md:items-end">
            <div>
              <h1 className="text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl">
                Shop Everything
                <span className="text-[#35C477]">.</span>
              </h1>

              <p className="mt-5 max-w-xl text-sm leading-7 text-gray-400 sm:text-base">
                Explore quality groceries, fresh products,
                and everyday essentials — all in one place.
              </p>
            </div>

            <div className="flex items-center gap-3 text-sm text-gray-300">
              <ShoppingBag
                size={20}
                className="text-[#35C477]"
              />
              <span>
                {visibleProducts.length} products available
              </span>
            </div>
          </div>

          
          <div className="relative mt-10 max-w-2xl">
            <Search
              size={20}
              className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-400"
            />

            <input
              type="search"
              value={search}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder="Search products, categories..."
              aria-label="Search products"
              className="w-full rounded-2xl border border-white/10 bg-white px-5 py-4 pl-14 text-sm text-gray-900 outline-none transition placeholder:text-gray-400 focus:ring-4 focus:ring-[#35C477]/20"
            />

            {search && (
              <button
                type="button"
                onClick={() => handleSearch("")}
                aria-label="Clear search"
                className="absolute right-5 top-1/2 -translate-y-1/2 text-gray-400 transition hover:text-gray-900"
              >
                <X size={18} />
              </button>
            )}
          </div>
        </div>
      </section>

      
      <section className="mx-auto max-w-7xl px-5 py-10 sm:px-8 lg:py-14">
      
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">
              All Products
            </h2>

            <p className="mt-1 text-sm text-gray-500">
              Showing {filteredProducts.length} products
            </p>
          </div>

          <div className="flex items-center gap-3">
            
            <button
              type="button"
              onClick={() => setShowFilters(!showFilters)}
              aria-expanded={showFilters}
              className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-medium transition hover:border-[#35C477] lg:hidden"
            >
              {showFilters ? (
                <X size={17} />
              ) : (
                <SlidersHorizontal size={17} />
              )}

              Filters
            </button>

           
            <div className="relative">
              <ArrowUpDown
                size={16}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"
              />

              <select
                value={sortBy}
                onChange={(e) =>
                  handleSort(e.target.value as SortOption)
                }
                aria-label="Sort products"
                className="appearance-none rounded-xl border border-gray-200 bg-white py-3 pl-9 pr-9 text-sm outline-none transition focus:border-[#35C477]"
              >
                <option value="popular">Most Popular</option>
                <option value="rating">Top Rated</option>
                <option value="price-low">
                  Price: Low to High
                </option>
                <option value="price-high">
                  Price: High to Low
                </option>
                <option value="name">Name: A to Z</option>
              </select>

              <ChevronDown
                size={15}
                className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-500"
              />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[230px_1fr]">
       
          <aside
            className={`
              ${showFilters ? "block" : "hidden"}
              h-fit rounded-2xl border border-gray-100 bg-white p-6
              lg:sticky lg:top-28 lg:block
            `}
          >
            <div className="mb-6 flex items-center justify-between">
              <h3 className="font-bold">Filters</h3>

              <button
                type="button"
                onClick={clearFilters}
                className="text-xs font-semibold text-[#279d5e] hover:underline"
              >
                Clear all
              </button>
            </div>

           
            <div className="border-b border-gray-100 pb-7">
              <h4 className="mb-4 text-sm font-semibold">
                Categories
              </h4>

              <div className="space-y-3">
                {categories.map((category) => (
                  <button
                    type="button"
                    key={category}
                    onClick={() => {
                      handleCategory(category);
                      setShowFilters(false);
                    }}
                    className={`
                      flex w-full items-center justify-between text-left text-sm transition
                      ${selectedCategory === category
                        ? "font-semibold text-[#279d5e]"
                        : "text-gray-500 hover:text-gray-900"
                      }
                    `}
                  >
                    {category}

                    {selectedCategory === category && (
                      <span className="h-2 w-2 rounded-full bg-[#35C477]" />
                    )}
                  </button>
                ))}
              </div>
            </div>

            
            <div className="pt-7">
              <div className="mb-4 flex items-center justify-between">
                <h4 className="text-sm font-semibold">
                  Maximum Price
                </h4>

                <span className="text-sm font-semibold text-[#279d5e]">
                  Rs. {maxPrice}
                </span>
              </div>

              <input
                type="range"
                min="50"
                max={DEFAULT_MAX_PRICE}
                step="10"
                value={maxPrice}
                onChange={(e) =>
                  handlePrice(Number(e.target.value))
                }
                aria-label="Maximum product price"
                className="w-full cursor-pointer accent-[#35C477]"
              />

              <div className="mt-2 flex justify-between text-xs text-gray-400">
                <span>Rs. 50</span>
                <span>Rs. 1,000</span>
              </div>
            </div>
          </aside>

          
          <div>
            
            <div className="mb-7 flex gap-2 overflow-x-auto pb-2">
              {categories.map((category) => (
                <button
                  type="button"
                  key={category}
                  onClick={() => handleCategory(category)}
                  className={`
                    shrink-0 rounded-full px-5 py-2.5 text-xs font-semibold transition
                    ${selectedCategory === category
                      ? "bg-[#35C477] text-white"
                      : "border border-gray-200 bg-white text-gray-600 hover:border-[#35C477] hover:text-[#279d5e]"
                    }
                  `}
                >
                  {category}
                </button>
              ))}
            </div>

           
            {pageProducts.length > 0 ? (
              <div className="grid grid-cols-2 gap-4 sm:gap-6 xl:grid-cols-4">
                {pageProducts.map((product) => {
                  const isWishlisted = wishlist.includes(product.id);

                  return (
                    <article
                      key={product.id}
                      className="group overflow-hidden rounded-2xl border border-gray-100 bg-white transition duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-black/5"
                    >
                     
                      <div className="relative aspect-square overflow-hidden bg-gray-50">
                        <Link
                          href={`/products/${product.id}`}
                          aria-label={`View ${product.name}`}
                          className="block h-full w-full"
                        >
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
                        </Link>

                        
                        {product.badge && (
                          <span className="absolute left-3 top-3 rounded-full bg-[#35C477] px-3 py-1.5 text-[10px] font-bold text-white">
                            {product.badge}
                          </span>
                        )}

                       
                        <button
                          type="button"
                          onClick={() => toggleWishlist(product.id)}
                          aria-label={
                            isWishlisted
                              ? "Remove from wishlist"
                              : "Add to wishlist"
                          }
                          aria-pressed={isWishlisted}
                          className={`
                            absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-white shadow-sm transition
                            ${isWishlisted
                              ? "text-red-500"
                              : "text-gray-500 hover:text-red-500"
                            }
                          `}
                        >
                          <Heart
                            size={17}
                            fill={
                              isWishlisted ? "currentColor" : "none"
                            }
                          />
                        </button>
                      </div>

                      
                      <div className="p-3 sm:p-4">
                        <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-[#279d5e]">
                          {product.category}
                        </p>

                        <Link href={`/products/${product.id}`}>
                          <h3 className="line-clamp-1 text-sm font-bold text-[#101A17] transition group-hover:text-[#279d5e] sm:text-base">
                            {product.name}
                          </h3>

                          <p className="mt-1 line-clamp-1 text-xs font-medium text-gray-500">
                            {product.nameNp || ""}
                          </p>
                        </Link>

                       
                        <div className="mt-2 flex items-center gap-1 text-xs text-amber-500">
                          <Star
                            size={13}
                            fill="currentColor"
                          />

                          <span className="font-semibold text-gray-700">
                            {product.rating}
                          </span>

                          <span className="text-gray-400">
                            ({product.reviews})
                          </span>
                        </div>

                       
                        <div className="mt-4 flex flex-wrap items-center gap-2">
                          <span className="text-sm font-bold sm:text-base">
                            Rs. {product.price}
                          </span>

                          {product.originalPrice && (
                            <span className="text-xs text-gray-400 line-through">
                              Rs. {product.originalPrice}
                            </span>
                          )}
                        </div>

                      
                        <button
                          type="button"
                          onClick={() => addToCart(product)}
                          className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-[#101A17] px-2 py-3 text-xs font-semibold text-white transition hover:bg-[#35C477] sm:text-sm"
                        >
                          <ShoppingCart size={15} />
                          Add to Cart
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : (
              
              <div className="flex min-h-[350px] flex-col items-center justify-center rounded-2xl border border-dashed border-gray-200 bg-white px-5 text-center">
                <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-gray-50 text-gray-400">
                  <PackageSearch size={30} />
                </div>

                <h3 className="text-xl font-bold">
                  No products found
                </h3>

                <p className="mt-2 max-w-sm text-sm leading-6 text-gray-500">
                  We couldn&apos;t find any products matching your
                  search or filters. Try changing your selection.
                </p>

                <button
                  type="button"
                  onClick={clearFilters}
                  className="mt-6 rounded-xl bg-[#35C477] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#279d5e]"
                >
                  Clear Filters
                </button>
              </div>
            )}

            
            {totalPages > 1 && (
              <div className="mt-12 flex flex-wrap items-center justify-center gap-2">
                <button
                  type="button"
                  disabled={safeCurrentPage === 1}
                  onClick={() =>
                    setCurrentPage((page) => Math.max(1, page - 1))
                  }
                  className="rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm transition hover:border-[#35C477] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Previous
                </button>

                {Array.from(
                  { length: totalPages },
                  (_, index) => index + 1
                ).map((page) => (
                  <button
                    type="button"
                    key={page}
                    onClick={() => setCurrentPage(page)}
                    aria-current={
                      safeCurrentPage === page ? "page" : undefined
                    }
                    className={`
                      h-10 w-10 rounded-lg text-sm font-semibold transition
                      ${safeCurrentPage === page
                        ? "bg-[#35C477] text-white"
                        : "border border-gray-200 bg-white hover:border-[#35C477]"
                      }
                    `}
                  >
                    {page}
                  </button>
                ))}

                <button
                  type="button"
                  disabled={safeCurrentPage >= totalPages}
                  onClick={() =>
                    setCurrentPage((page) =>
                      Math.min(totalPages, page + 1)
                    )
                  }
                  className="rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm transition hover:border-[#35C477] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            )}
          </div>
        </div>
      </section>

   
      {message && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-5 right-5 z-50 flex max-w-[calc(100vw-40px)] items-center gap-3 rounded-xl bg-[#101A17] px-5 py-4 text-sm font-medium text-white shadow-xl"
        >
          <ShoppingCart
            size={18}
            className="shrink-0 text-[#35C477]"
          />
          {message}
        </div>
      )}

      
      <Link
        href="/cart"
        aria-label={`Open cart, ${cartCount} items`}
        className="fixed bottom-5 left-5 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-[#35C477] text-white shadow-lg shadow-[#35C477]/30 transition hover:scale-105"
      >
        <ShoppingCart size={22} />

        {cartCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-6 min-w-6 items-center justify-center rounded-full bg-[#101A17] px-1 text-[10px] font-bold text-white">
            {cartCount}
          </span>
        )}
      </Link>
    </main>
  );
}
