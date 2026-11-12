"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  Check,
  Heart,
  Minus,
  Plus,
  ShoppingCart,
  Star,
  Truck,
  ShieldCheck,
  RotateCcw,
  Package,
} from "lucide-react";

import { products } from "@/data/products";
import type { Product } from "@/data/products";

import {
  type CartItem,
  getCart,
  saveCart,
  getWishlist,
  getWishlistSnapshot,
  getEmptyWishlistSnapshot,
  saveWishlist,
  subscribeToShopStorage,
} from "@/lib/shop-storage";

export default function ProductDetailsPage() {
  const params = useParams<{ id: string }>();

  const productId = Number(params.id);

  const product = products.find(
    (item) => item.id === productId
  );

  const [quantity, setQuantity] = useState(1);
  const [message, setMessage] = useState("");

  const wishlist = useSyncExternalStore(
    subscribeToShopStorage,
    getWishlistSnapshot,
    getEmptyWishlistSnapshot
  );

  const isWishlisted = product
    ? wishlist.includes(product.id)
    : false;

  
  useEffect(() => {
    if (!message) return;

    const timer = window.setTimeout(() => {
      setMessage("");
    }, 2500);

    return () => window.clearTimeout(timer);
  }, [message]);


  const increaseQuantity = () => {
    setQuantity((previous) => previous + 1);
  };

  const decreaseQuantity = () => {
    setQuantity((previous) =>
      Math.max(1, previous - 1)
    );
  };

 
  const addToCart = (item: Product) => {
    const currentCart = getCart();

    const existingItem = currentCart.find(
      (cartItem) => cartItem.id === item.id
    );

    let updatedCart: CartItem[];

    if (existingItem) {
      updatedCart = currentCart.map((cartItem) =>
        cartItem.id === item.id
          ? {
            ...cartItem,
            quantity: cartItem.quantity + quantity,
          }
          : cartItem
      );
    } else {
      updatedCart = [
        ...currentCart,
        {
          id: item.id,
          name: item.name,
          price: item.price,
          image: item.image,
          quantity,
        },
      ];
    }

    const saved = saveCart(updatedCart);

    if (!saved) {
      setMessage("Unable to add product to cart.");
      return;
    }

    setMessage(`${item.name} added to cart!`);
  };

  
  const toggleWishlist = (productId: number) => {
    const currentWishlist = getWishlist();

    const updatedWishlist = currentWishlist.includes(
      productId
    )
      ? currentWishlist.filter((id) => id !== productId)
      : [...currentWishlist, productId];

    const saved = saveWishlist(updatedWishlist);

    if (!saved) {
      setMessage("Unable to update wishlist.");
      return;
    }

    setMessage(
      currentWishlist.includes(productId)
        ? "Removed from wishlist."
        : "Added to wishlist!"
    );
  };

  
  if (!product) {
    return (
      <main className="flex min-h-[70vh] items-center justify-center bg-[#fafafa] px-5">
        <div className="max-w-md text-center">
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-gray-100 text-gray-400">
            <Package size={36} />
          </div>

          <h1 className="text-2xl font-bold text-[#101A17]">
            Product Not Found
          </h1>

          <p className="mt-3 text-sm leading-6 text-gray-500">
            {`Sorry, we couldn't find the product you're
            looking for.`}
          </p>

          <Link
            href="/products"
            className="mt-7 inline-flex items-center gap-2 rounded-xl bg-[#35C477] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#279d5e]"
          >
            <ArrowLeft size={17} />
            Back to Shop
          </Link>
        </div>
      </main>
    );
  }

 
  const relatedProducts = products
    .filter(
      (item) =>
        item.category === product.category &&
        item.id !== product.id
    )
    .slice(0, 4);

  const discount = product.originalPrice
    ? Math.round(
      ((product.originalPrice - product.price) /
        product.originalPrice) *
      100
    )
    : 0;

  return (
    <main className="min-h-screen bg-[#fafafa] text-[#171717]">
      
      <section className="border-b border-gray-100 bg-white">
        <div className="mx-auto max-w-7xl px-5 py-5 sm:px-8">
          <div className="flex flex-wrap items-center gap-2 text-xs text-gray-400 sm:text-sm">
            <Link
              href="/"
              className="transition hover:text-[#279d5e]"
            >
              Home
            </Link>

            <span>/</span>

            <Link
              href="/products"
              className="transition hover:text-[#279d5e]"
            >
              Shop
            </Link>

            <span>/</span>

            <span className="text-gray-700">
              {product.category}
            </span>

            <span>/</span>

            <span className="font-medium text-[#101A17]">
              {product.name}
            </span>
          </div>
        </div>
      </section>

     
      <section className="mx-auto max-w-7xl px-5 py-10 sm:px-8 sm:py-14">
        
        <Link
          href="/products"
          className="mb-8 inline-flex items-center gap-2 text-sm font-medium text-gray-500 transition hover:text-[#279d5e]"
        >
          <ArrowLeft size={17} />
          Continue Shopping
        </Link>

        <div className="grid grid-cols-1 gap-10 lg:grid-cols-2 lg:gap-16">
          
          <div>
            <div className="relative overflow-hidden rounded-3xl border border-gray-100 bg-white p-4 sm:p-8">
              {product.badge && (
                <span className="absolute left-7 top-7 z-10 rounded-full bg-[#35C477] px-4 py-2 text-xs font-bold text-white">
                  {product.badge}
                </span>
              )}

              {discount > 0 && (
                <span className="absolute right-7 top-7 z-10 rounded-full bg-red-500 px-3 py-2 text-xs font-bold text-white">
                  {discount}% OFF
                </span>
              )}

              <div className="flex aspect-square items-center justify-center overflow-hidden rounded-2xl bg-gray-50">
                <img
                  src={product.image}
                  alt={product.name}
                  className="h-full w-full object-cover transition duration-500 hover:scale-105"
                />
              </div>
            </div>

            <p className="mt-4 text-center text-xs text-gray-400">
              Product image
            </p>
          </div>

          
          <div className="flex flex-col">
            <p className="mb-3 text-xs font-bold uppercase tracking-[0.2em] text-[#279d5e]">
              {product.category}
            </p>

            <h3 className="line-clamp-1 text-sm font-bold text-[#101A17] transition group-hover:text-[#279d5e] sm:text-base">
              {product.name}
            </h3>

            <p className="mt-1 line-clamp-1 text-xs font-medium text-gray-500">
              {product.nameNp}
            </p>

          
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-1 text-amber-500">
                <Star size={17} fill="currentColor" />

                <span className="font-bold text-[#101A17]">
                  {product.rating}
                </span>
              </div>

              <span className="text-sm text-gray-400">
                ({product.reviews} customer reviews)
              </span>
            </div>

           
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <span className="text-3xl font-bold text-[#101A17]">
                Rs. {product.price}
              </span>

              {product.originalPrice && (
                <>
                  <span className="text-lg text-gray-400 line-through">
                    Rs. {product.originalPrice}
                  </span>

                  <span className="rounded-lg bg-green-50 px-3 py-1.5 text-xs font-bold text-[#279d5e]">
                    Save Rs.{" "}
                    {product.originalPrice - product.price}
                  </span>
                </>
              )}
            </div>

           
            <div className="mt-8 border-t border-gray-200 pt-7">
              <h2 className="mb-3 text-sm font-bold text-[#101A17]">
                Product Description
              </h2>

              <p className="text-sm leading-7 text-gray-500">
                {product.description}
              </p>
            </div>

         
            <div className="mt-7 flex items-center gap-2 text-sm font-medium text-[#279d5e]">
              <Check size={18} />
              Available for purchase
            </div>

            <div className="mt-8">
              <p className="mb-3 text-sm font-semibold text-[#101A17]">
                Quantity
              </p>

              <div className="flex h-12 w-fit items-center overflow-hidden rounded-xl border border-gray-200 bg-white">
                <button
                  type="button"
                  onClick={decreaseQuantity}
                  disabled={quantity <= 1}
                  aria-label="Decrease quantity"
                  className="flex h-full w-12 items-center justify-center text-gray-600 transition hover:bg-gray-100 disabled:opacity-40"
                >
                  <Minus size={17} />
                </button>

                <span className="flex h-full min-w-12 items-center justify-center border-x border-gray-200 px-3 text-sm font-bold">
                  {quantity}
                </span>

                <button
                  type="button"
                  onClick={increaseQuantity}
                  aria-label="Increase quantity"
                  className="flex h-full w-12 items-center justify-center text-gray-600 transition hover:bg-gray-100"
                >
                  <Plus size={17} />
                </button>
              </div>
            </div>

          
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={() => addToCart(product)}
                className="flex flex-1 items-center justify-center gap-3 rounded-xl bg-[#101A17] px-6 py-4 text-sm font-bold text-white transition hover:bg-[#35C477]"
              >
                <ShoppingCart size={19} />
                Add to Cart
              </button>

              <button
                type="button"
                onClick={() => toggleWishlist(product.id)}
                aria-label={
                  isWishlisted
                    ? "Remove from wishlist"
                    : "Add to wishlist"
                }
                aria-pressed={isWishlisted}
                className={`flex h-14 items-center justify-center gap-2 rounded-xl border px-6 text-sm font-semibold transition ${isWishlisted
                    ? "border-red-200 bg-red-50 text-red-500"
                    : "border-gray-200 bg-white text-gray-600 hover:border-red-200 hover:text-red-500"
                  }`}
              >
                <Heart
                  size={19}
                  fill={isWishlisted ? "currentColor" : "none"}
                />

                {isWishlisted ? "Wishlisted" : "Wishlist"}
              </button>
            </div>

           
            <div className="mt-9 grid grid-cols-1 gap-5 border-t border-gray-200 pt-7 sm:grid-cols-3">
              <div className="flex items-start gap-3">
                <Truck className="shrink-0 text-[#279d5e]" size={21} />

                <div>
                  <p className="text-xs font-bold text-[#101A17]">
                    Delivery
                  </p>
                  <p className="mt-1 text-[11px] text-gray-400">
                    Delivery information
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <ShieldCheck
                  className="shrink-0 text-[#279d5e]"
                  size={21}
                />

                <div>
                  <p className="text-xs font-bold text-[#101A17]">
                    Quality
                  </p>
                  <p className="mt-1 text-[11px] text-gray-400">
                    Quality-focused shopping
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <RotateCcw
                  className="shrink-0 text-[#279d5e]"
                  size={21}
                />

                <div>
                  <p className="text-xs font-bold text-[#101A17]">
                    Support
                  </p>
                  <p className="mt-1 text-[11px] text-gray-400">
                    Customer assistance
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

    
      {relatedProducts.length > 0 && (
        <section className="border-t border-gray-100 bg-white">
          <div className="mx-auto max-w-7xl px-5 py-14 sm:px-8">
            <div className="mb-8 flex items-end justify-between gap-4">
              <div>
                <p className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-[#279d5e]">
                  You may also like
                </p>

                <h2 className="text-2xl font-bold text-[#101A17] sm:text-3xl">
                  Related Products
                </h2>
              </div>

              <Link
                href="/products"
                className="text-sm font-semibold text-[#279d5e] transition hover:text-[#101A17]"
              >
                View all
              </Link>
            </div>

            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 sm:gap-6">
              {relatedProducts.map((item) => (
                <Link
                  key={item.id}
                  href={`/products/${item.id}`}
                  className="group overflow-hidden rounded-2xl border border-gray-100 bg-white transition hover:-translate-y-1 hover:shadow-lg"
                >
                  <div className="aspect-square overflow-hidden bg-gray-50">
                    <img
                      src={item.image}
                      alt={item.name}
                      loading="lazy"
                      className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                    />
                  </div>

                  <div className="p-3 sm:p-4">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-[#279d5e]">
                      {item.category}
                    </p>

                    <h3 className="mt-2 line-clamp-2 min-h-10 text-sm font-semibold text-[#101A17] transition group-hover:text-[#279d5e]">
                      {item.name}
                    </h3>
                    <h3 className="mt-2 line-clamp-2 min-h-10 text-sm font-semibold text-[#101A17] transition group-hover:text-[#279d5e]">
                      {item.nameNp}
                    </h3>

                    <div className="mt-3 flex items-center justify-between gap-2">
                      <span className="text-sm font-bold text-[#101A17]">
                        Rs. {item.price}
                      </span>

                      <span className="flex items-center gap-1 text-xs text-amber-500">
                        <Star size={12} fill="currentColor" />
                        {item.rating}
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

     
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
    </main>
  );
}