
"use client";

import { useSyncExternalStore } from "react";
import Link from "next/link";
import {
  Heart,
  ShoppingCart,
  Trash2,
  ArrowRight,
  ShoppingBag,
  Star,
} from "lucide-react";

import { products } from "@/data/products";

import {
  getWishlistSnapshot,
  getEmptyWishlistSnapshot,
  saveWishlist,
  subscribeToShopStorage,
  getCart,
  saveCart,
  type CartItem,
} from "@/lib/shop-storage";

export default function WishlistPage() {
  const wishlist = useSyncExternalStore(
    subscribeToShopStorage,
    getWishlistSnapshot,
    getEmptyWishlistSnapshot
  );

 
  const wishlistProducts = products.filter((product) =>
    wishlist.includes(product.id)
  );

  const removeFromWishlist = (productId: number) => {
    const updatedWishlist = wishlist.filter(
      (id) => id !== productId
    );

    saveWishlist(updatedWishlist);
  };

 
  const addToCart = (product: (typeof products)[number]) => {
    const cart = getCart();

    const existingItem = cart.find(
      (item) => item.id === product.id
    );

    let updatedCart: CartItem[];

    if (existingItem) {
      updatedCart = cart.map((item) =>
        item.id === product.id
          ? { ...item, quantity: item.quantity + 1 }
          : item
      );
    } else {
      updatedCart = [
        ...cart,
        {
          id: product.id,
          name: product.name,
          price: product.price,
          image: product.image,
          quantity: 1,
        },
      ];
    }

    saveCart(updatedCart);
  };

  const formatPrice = (price: number) =>
    `Rs. ${price.toLocaleString("en-NP")}`;

  return (
    <main className="min-h-screen bg-[#fafafa] text-[#101A17]">

      
      <section className="bg-[#101A17] px-5 py-14 text-white sm:px-8 sm:py-16">
        <div className="mx-auto max-w-7xl">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#35C477]/15 text-[#35C477]">
            <Heart size={29} />
          </div>

          <p className="mb-3 text-xs font-bold uppercase tracking-[0.25em] text-[#35C477]">
            Your personal collection
          </p>

          <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
            <div>
              <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
                My Wishlist
                <span className="text-[#35C477]">.</span>
              </h1>

              <p className="mt-3 max-w-xl text-sm leading-7 text-gray-400 sm:text-base">
                Keep your favorite products in one place
                and shop them whenever you like.
              </p>

              <p className="mt-2 text-sm text-gray-300">
                तपाईंका मनपर्ने सामानहरू एउटै ठाउँमा सुरक्षित राख्नुहोस्।
              </p>
            </div>

            <div className="rounded-xl border border-white/10 bg-white/5 px-5 py-4">
              <p className="text-2xl font-bold">
                {wishlistProducts.length}
              </p>
              <p className="mt-1 text-xs text-gray-400">
                Saved products
              </p>
            </div>
          </div>
        </div>
      </section>

      
      <section className="mx-auto max-w-7xl px-5 py-12 sm:px-8 sm:py-16">
        {wishlistProducts.length > 0 ? (
          <>
            <div className="mb-8 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
              <div>
                <h2 className="text-2xl font-bold">
                  Your Favorite Products
                </h2>
                <p className="mt-1 text-sm text-gray-500">
                  {wishlistProducts.length}{" "}
                  {wishlistProducts.length === 1
                    ? "product"
                    : "products"}{" "}
                  saved in your wishlist.
                </p>
              </div>

              <Link
                href="/products"
                className="inline-flex items-center gap-2 text-sm font-semibold text-[#279d5e] hover:underline"
              >
                Continue Shopping
                <ArrowRight size={16} />
              </Link>
            </div>

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {wishlistProducts.map((product) => (
                <article
                  key={product.id}
                  className="group overflow-hidden rounded-2xl border border-gray-100 bg-white transition duration-300 hover:-translate-y-1 hover:shadow-lg"
                >
                  
                  <div className="relative aspect-[4/3] overflow-hidden bg-gray-100">
                    <Link href={`/products/${product.id}`}>
                      <img
                        src={product.image}
                        alt={product.name}
                        loading="lazy"
                        className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                      />
                    </Link>

                    {product.badge && (
                      <span className="absolute left-3 top-3 rounded-full bg-[#35C477] px-3 py-1 text-[10px] font-bold text-white">
                        {product.badge}
                      </span>
                    )}

                    <button
                      type="button"
                      onClick={() =>
                        removeFromWishlist(product.id)
                      }
                      aria-label={`Remove ${product.name} from wishlist`}
                      className="absolute right-3 top-3 flex h-10 w-10 items-center justify-center rounded-full bg-white text-red-500 shadow-md transition hover:bg-red-500 hover:text-white"
                    >
                      <Trash2 size={17} />
                    </button>
                  </div>

                  
                  <div className="p-4">
                    <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-[#279d5e]">
                      {product.category}
                    </p>

                    <Link href={`/products/${product.id}`}>
                      <h3 className="line-clamp-1 text-base font-bold transition hover:text-[#279d5e]">
                        {product.name}
                      </h3>

                      <p className="mt-1 line-clamp-1 text-xs font-medium text-gray-500">
                        {product.nameNp ?? ""}
                      </p>
                    </Link>

                   
                    <div className="mt-3 flex items-center gap-1 text-xs text-gray-500">
                      <Star
                        size={14}
                        className="fill-amber-400 text-amber-400"
                      />
                      <span className="font-semibold text-[#101A17]">
                        {product.rating}
                      </span>
                      <span>({product.reviews} reviews)</span>
                    </div>

                    
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <span className="text-lg font-bold text-[#279d5e]">
                        {formatPrice(product.price)}
                      </span>

                      {product.originalPrice &&
                        product.originalPrice > product.price && (
                          <span className="text-xs text-gray-400 line-through">
                            {formatPrice(product.originalPrice)}
                          </span>
                        )}
                    </div>

                    
                    <div className="mt-5 grid grid-cols-[1fr_auto] gap-2">
                      <button
                        type="button"
                        onClick={() => addToCart(product)}
                        className="flex h-11 items-center justify-center gap-2 rounded-xl bg-[#101A17] px-3 text-xs font-semibold text-white transition hover:bg-[#279d5e] sm:text-sm"
                      >
                        <ShoppingCart size={16} />
                        Add to Cart
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          removeFromWishlist(product.id)
                        }
                        aria-label={`Remove ${product.name}`}
                        className="flex h-11 w-11 items-center justify-center rounded-xl border border-gray-200 text-gray-500 transition hover:border-red-200 hover:bg-red-50 hover:text-red-500"
                      >
                        <Heart size={18} />
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </>
        ) : (
         
          <div className="mx-auto flex max-w-xl flex-col items-center rounded-3xl border border-gray-100 bg-white px-6 py-16 text-center shadow-sm sm:py-20">
            <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-[#EAF8EF] text-[#35C477]">
              <Heart size={36} />
            </div>

            <h2 className="text-2xl font-bold">
              Your wishlist is empty
            </h2>

            <p className="mt-3 text-sm leading-7 text-gray-500">
             {` You haven't saved any products yet. Explore
              our collection and add your favorite items
              to your wishlist.`}
            </p>

            <p className="mt-2 text-sm text-gray-500">
              तपाईंले अहिलेसम्म कुनै सामान मनपर्ने सूचीमा राख्नुभएको छैन।
            </p>

            <Link
              href="/products"
              className="mt-7 inline-flex items-center gap-2 rounded-xl bg-[#101A17] px-7 py-4 text-sm font-semibold text-white transition hover:bg-[#279d5e]"
            >
              <ShoppingBag size={17} />
              Explore Products
              <ArrowRight size={16} />
            </Link>
          </div>
        )}
      </section>
    </main>
  );
}
