
"use client";

import { useSyncExternalStore } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Minus,
  Plus,
  ShoppingCart,
  Trash2,
  ShoppingBag,
  ShieldCheck,
  Truck,
  ArrowRight,
  PackageCheck,
} from "lucide-react";

import {
  getCart,
  getCartSnapshot,
  getEmptyCartSnapshot,
  saveCart,
  subscribeToShopStorage,
  type CartItem,
} from "@/lib/shop-storage";

export default function CartPage() {
 
  const cart = useSyncExternalStore(
    subscribeToShopStorage,
    getCartSnapshot,
    getEmptyCartSnapshot
  );


  const subtotal = cart.reduce(
    (total, item) => total + item.price * item.quantity,
    0
  );

  
  const totalItems = cart.reduce(
    (total, item) => total + item.quantity,
    0
  );

  
  const formatPrice = (price: number) =>
    `Rs. ${price.toLocaleString("en-NP")}`;

  
  const updateQuantity = (productId: number, change: number) => {
    const currentCart = getCart();

    const updatedCart = currentCart.map((item) =>
      item.id === productId
        ? {
          ...item,
          quantity: Math.max(1, item.quantity + change),
        }
        : item
    );

    saveCart(updatedCart);
  };

 
  const removeItem = (productId: number) => {
    const updatedCart = getCart().filter(
      (item) => item.id !== productId
    );

    saveCart(updatedCart);
  };

  
  const clearCart = () => {
    saveCart([]);
  };

  
  if (cart.length === 0) {
    return (
      <main className="flex min-h-[75vh] items-center justify-center bg-[#fafafa] px-5 py-20">
        <div className="mx-auto flex max-w-md flex-col items-center text-center">
          <div className="mb-7 flex h-24 w-24 items-center justify-center rounded-full bg-[#35C477]/10 text-[#279d5e]">
            <ShoppingBag size={42} strokeWidth={1.5} />
          </div>

          <p className="mb-3 text-xs font-bold uppercase tracking-[0.25em] text-[#279d5e]">
            Your shopping bag
          </p>

          <h1 className="text-3xl font-bold tracking-tight text-[#101A17] sm:text-4xl">
            Your cart is empty<span className="text-[#35C477]">.</span>
          </h1>

          <p className="mt-4 text-sm leading-7 text-gray-500">
            {`Looks like you haven't added anything to your
            shopping cart yet. Explore our fresh products
            and find something you love.`}
          </p>

          <Link
            href="/products"
            className="mt-8 inline-flex items-center gap-3 rounded-xl bg-[#101A17] px-7 py-4 text-sm font-semibold text-white transition hover:bg-[#279d5e]"
          >
            <ShoppingBag size={18} />
            Start Shopping
            <ArrowRight size={17} />
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#fafafa] text-[#171717]">

      <section className="bg-[#101A17] px-5 py-12 text-white sm:px-8 sm:py-16">
        <div className="mx-auto max-w-7xl">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.3em] text-[#35C477]">
            Your shopping bag
          </p>

          <div className="flex flex-wrap items-end justify-between gap-5">
            <div>
              <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
                My Cart<span className="text-[#35C477]">.</span>
              </h1>

              <p className="mt-3 text-sm text-gray-400">
                You have {totalItems}{" "}
                {totalItems === 1 ? "item" : "items"} in your cart.
              </p>
            </div>

            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/5 text-[#35C477]">
              <ShoppingCart size={34} strokeWidth={1.5} />
            </div>
          </div>
        </div>
      </section>
      <section className="mx-auto max-w-7xl px-5 py-10 sm:px-8 lg:py-14">

        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <Link
            href="/products"
            className="inline-flex items-center gap-2 text-sm font-semibold text-gray-500 transition hover:text-[#279d5e]"
          >
            <ArrowLeft size={17} />
            Continue Shopping
          </Link>

          <button
            type="button"
            onClick={clearCart}
            className="inline-flex items-center gap-2 text-sm font-semibold text-red-500 transition hover:text-red-700"
          >
            <Trash2 size={16} />
            Clear Cart
          </button>
        </div>

        <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-[1fr_360px]">

          <div className="space-y-4">
            {cart.map((item: CartItem) => (
              <article
                key={item.id}
                className="flex flex-col gap-5 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm transition hover:shadow-md sm:flex-row sm:items-center sm:p-5"
              >
                <Link
                  href={`/products/${item.id}`}
                  className="h-36 w-full shrink-0 overflow-hidden rounded-xl bg-gray-50 sm:h-28 sm:w-28"
                >
                  <img
                    src={item.image}
                    alt={item.name}
                    className="h-full w-full object-cover transition duration-300 hover:scale-105"
                  />
                </Link>

                <div className="min-w-0 flex-1">
                  <Link
                    href={`/products/${item.id}`}
                    className="text-base font-bold text-[#101A17] transition hover:text-[#279d5e]"
                  >
                    {item.name}
                  </Link>

                  <p className="mt-2 text-sm text-gray-500">
                    {formatPrice(item.price)} / item
                  </p>

                  <p className="mt-3 text-sm font-bold text-[#279d5e]">
                    {formatPrice(item.price * item.quantity)}
                  </p>
                </div>

                <div className="flex items-center justify-between gap-4 sm:flex-col sm:items-end">
                  <div className="flex h-10 items-center overflow-hidden rounded-lg border border-gray-200">
                    <button
                      type="button"
                      onClick={() => updateQuantity(item.id, -1)}
                      disabled={item.quantity <= 1}
                      aria-label={`Decrease ${item.name} quantity`}
                      className="flex h-full w-9 items-center justify-center text-gray-500 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-30"
                    >
                      <Minus size={15} />
                    </button>

                    <span className="flex h-full min-w-10 items-center justify-center border-x border-gray-200 px-2 text-sm font-semibold">
                      {item.quantity}
                    </span>

                    <button
                      type="button"
                      onClick={() => updateQuantity(item.id, 1)}
                      aria-label={`Increase ${item.name} quantity`}
                      className="flex h-full w-9 items-center justify-center text-gray-500 transition hover:bg-gray-100"
                    >
                      <Plus size={15} />
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => removeItem(item.id)}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-500 transition hover:text-red-700"
                  >
                    <Trash2 size={14} />
                    Remove
                  </button>
                </div>
              </article>
            ))}
          </div>

          <aside className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm lg:sticky lg:top-28">
            <h2 className="text-xl font-bold text-[#101A17]">
              Order Summary
            </h2>

            <div className="mt-7 space-y-5 border-b border-gray-100 pb-6">
              <div className="flex justify-between gap-3 text-sm">
                <span className="text-gray-500">
                  Items ({totalItems})
                </span>

                <span className="font-semibold text-[#101A17]">
                  {formatPrice(subtotal)}
                </span>
              </div>

              <div className="flex justify-between gap-3 text-sm">
                <span className="text-gray-500">
                  Delivery
                </span>

                <span className="font-medium text-gray-500">
                  Calculated at checkout
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between py-6">
              <span className="font-bold text-[#101A17]">
                Subtotal
              </span>

              <span className="text-xl font-bold text-[#101A17]">
                {formatPrice(subtotal)}
              </span>
            </div>

            <Link
              href="/checkout"
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#101A17] px-5 py-4 text-sm font-bold text-white transition hover:bg-[#279d5e]"
            >
              Proceed to Checkout
              <ArrowRight size={17} />
            </Link>

            <p className="mt-3 text-center text-xs text-gray-400">
              Review your details before placing your order.
            </p>


            <div className="mt-7 space-y-4 border-t border-gray-100 pt-6">
              <div className="flex items-center gap-3 text-xs text-gray-500">
                <Truck size={18} className="shrink-0 text-[#279d5e]" />
                Delivery details at checkout
              </div>

              <div className="flex items-center gap-3 text-xs text-gray-500">
                <ShieldCheck size={18} className="shrink-0 text-[#279d5e]" />
                Secure shopping experience
              </div>

              <div className="flex items-center gap-3 text-xs text-gray-500">
                <PackageCheck size={18} className="shrink-0 text-[#279d5e]" />
                Carefully packed products
              </div>
            </div>
          </aside>
        </div>
      </section>
    </main>
  );
}
