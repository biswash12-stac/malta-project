
"use client";

import { Suspense, useSyncExternalStore } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  CheckCircle2,
  Package,
  MapPin,
  Phone,
  Mail,
  ShoppingBag,
  ArrowRight,
  Clock,
  Truck,
} from "lucide-react";

import {
  getOrderById,
  getOrdersSnapshot,
  getServerOrdersSnapshot,
  subscribeToOrders,
  type AdminOrder,
} from "@/lib/order-storage";

const formatPrice = (price: number) =>
  `Rs. ${price.toLocaleString("en-NP")}`;

function OrderConfirmationContent() {
  const searchParams = useSearchParams();
  const orderId = searchParams.get("order");

  const orders = useSyncExternalStore(
    subscribeToOrders,
    getOrdersSnapshot,
    getServerOrdersSnapshot
  );

 const order: AdminOrder | null = orderId
  ? orders.find((item) => item.id === orderId) ??
    getOrderById(orderId) ??
    null
  : null;

  return (
    <main className="min-h-screen bg-[#fafafa] px-5 py-12 sm:px-8 sm:py-16">
      <div className="mx-auto max-w-3xl">
        {!order ? (
          <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
            <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-red-50 text-red-500">
              <Package size={36} />
            </div>

            <h1 className="text-2xl font-bold text-[#101A17]">
              Order Not Found
            </h1>

            <p className="mt-3 max-w-md text-sm leading-6 text-gray-500">
             {` We couldn't find this order. Please check your order link
              or return to the shop.`}
            </p>

            <Link
              href="/products"
              className="mt-7 inline-flex items-center gap-2 rounded-xl bg-[#101A17] px-6 py-3.5 text-sm font-semibold text-white transition hover:bg-[#279d5e]"
            >
              Continue Shopping
              <ArrowRight size={17} />
            </Link>
          </div>
        ) : (
          <>
            <div className="text-center">
              <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-[#35C477]/10 text-[#279d5e]">
                <CheckCircle2 size={45} strokeWidth={1.8} />
              </div>

              <p className="mt-6 text-xs font-bold uppercase tracking-[0.25em] text-[#279d5e]">
                Order successfully placed
              </p>

              <h1 className="mt-3 text-3xl font-bold tracking-tight text-[#101A17] sm:text-4xl">
                Thank You for Your Order!
              </h1>

              <p className="mx-auto mt-3 max-w-lg text-sm leading-7 text-gray-500">
                {`Your order has been received. We'll prepare your items
                and update you as your order progresses.`}
              </p>
            </div>
            <section className="mt-10 rounded-2xl border border-gray-100 bg-white p-6 shadow-sm sm:p-8">
              <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wider text-gray-400">
                    Order Number
                  </p>

                  <h2 className="mt-2 text-2xl font-bold text-[#101A17]">
                    {order.orderNumber}
                  </h2>

                  <p className="mt-2 text-xs text-gray-500">
                    Placed on{" "}
                    {new Date(order.createdAt).toLocaleString("en-NP", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </p>
                </div>

                <div className="w-fit rounded-full bg-yellow-50 px-4 py-2 text-xs font-bold text-yellow-700">
                  {order.status}
                </div>
              </div>

              <div className="my-7 border-t border-gray-100" />

              <div className="grid gap-5 sm:grid-cols-2">
                <div className="flex items-start gap-3">
                  <div className="rounded-xl bg-yellow-50 p-3 text-yellow-600">
                    <Clock size={20} />
                  </div>

                  <div>
                    <p className="text-sm font-semibold text-[#101A17]">
                      Order Status
                    </p>
                    <p className="mt-1 text-xs text-gray-500">
                      {order.status === "PENDING"
                        ? "Waiting for confirmation"
                        : order.status}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="rounded-xl bg-[#35C477]/10 p-3 text-[#279d5e]">
                    <Truck size={20} />
                  </div>

                  <div>
                    <p className="text-sm font-semibold text-[#101A17]">
                      Payment Method
                    </p>
                    <p className="mt-1 text-xs text-gray-500">
                      Cash on Delivery
                    </p>
                  </div>
                </div>
              </div>
            </section>

            
            <section className="mt-6 rounded-2xl border border-gray-100 bg-white p-6 shadow-sm sm:p-8">
              <h2 className="text-lg font-bold text-[#101A17]">
                Order Summary
              </h2>

              <div className="mt-6 space-y-5">
                {order.items.map((item, index) => (
                  <div
                    key={`${item.productId}-${index}`}
                    className="flex items-center gap-4"
                  >
                    <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-gray-50">
                      <img
                        src={item.image}
                        alt={item.name}
                        className="h-full w-full object-cover"
                      />
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-2 text-sm font-semibold text-[#101A17]">
                        {item.name}
                      </p>

                      {item.nameNp && (
                        <p className="mt-1 text-xs text-gray-500">
                          {item.nameNp}
                        </p>
                      )}

                      <p className="mt-1 text-xs text-gray-500">
                        Quantity: {item.quantity}
                      </p>
                    </div>

                    <p className="shrink-0 text-sm font-bold text-[#101A17]">
                      {formatPrice(item.price * item.quantity)}
                    </p>
                  </div>
                ))}
              </div>

              <div className="mt-7 space-y-4 border-t border-gray-100 pt-6 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Subtotal</span>
                  <span className="font-semibold">
                    {formatPrice(order.subtotal)}
                  </span>
                </div>

                <div className="flex justify-between">
                  <span className="text-gray-500">Delivery Charge</span>
                  <span className="font-semibold">
                    {formatPrice(order.deliveryCharge)}
                  </span>
                </div>

                <div className="flex justify-between border-t border-gray-100 pt-5">
                  <span className="font-bold text-[#101A17]">
                    Total Amount
                  </span>

                  <span className="text-xl font-bold text-[#279d5e]">
                    {formatPrice(order.total)}
                  </span>
                </div>
              </div>
            </section>

           
            <section className="mt-6 rounded-2xl border border-gray-100 bg-white p-6 shadow-sm sm:p-8">
              <h2 className="text-lg font-bold text-[#101A17]">
                Delivery Details
              </h2>

              <div className="mt-6 space-y-5">
                <div className="flex items-start gap-3">
                  <div className="rounded-xl bg-gray-50 p-3 text-gray-500">
                    <MapPin size={19} />
                  </div>

                  <div>
                    <p className="text-sm font-semibold text-[#101A17]">
                      Delivery Address
                    </p>
                    <p className="mt-1 text-sm leading-6 text-gray-500">
                      {order.customer.address}
                      <br />
                      {order.customer.city}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="rounded-xl bg-gray-50 p-3 text-gray-500">
                    <Phone size={19} />
                  </div>

                  <div>
                    <p className="text-sm font-semibold text-[#101A17]">
                      Phone Number
                    </p>
                    <p className="mt-1 text-sm text-gray-500">
                      {order.customer.phone}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="rounded-xl bg-gray-50 p-3 text-gray-500">
                    <Mail size={19} />
                  </div>

                  <div>
                    <p className="text-sm font-semibold text-[#101A17]">
                      Email Address
                    </p>
                    <p className="mt-1 break-all text-sm text-gray-500">
                      {order.customer.email}
                    </p>
                  </div>
                </div>
              </div>
            </section>

           
            <section className="mt-6 rounded-2xl border border-[#35C477]/20 bg-[#35C477]/5 p-5 sm:p-6">
              <div className="flex items-start gap-3">
                <CheckCircle2
                  size={21}
                  className="mt-0.5 shrink-0 text-[#279d5e]"
                />

                <div>
                  <h3 className="text-sm font-bold text-[#101A17]">
                    Cash on Delivery
                  </h3>

                  <p className="mt-1 text-xs leading-6 text-gray-600">
                    Please prepare {formatPrice(order.total)} in cash.
                    You can pay when your order is delivered.
                  </p>
                </div>
              </div>
            </section>

           
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/products"
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#101A17] px-6 py-4 text-sm font-bold text-white transition hover:bg-[#279d5e]"
              >
                <ShoppingBag size={17} />
                Continue Shopping
              </Link>

              <Link
                href="/"
                className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-6 py-4 text-sm font-bold text-[#101A17] transition hover:border-[#279d5e] hover:text-[#279d5e]"
              >
                Back to Home
                <ArrowRight size={17} />
              </Link>
            </div>

            <p className="mt-8 text-center text-xs leading-6 text-gray-400">
              Thank you for shopping with Malta. We appreciate your trust!
            </p>
          </>
        )}
      </div>
    </main>
  );
}

function OrderConfirmationFallback() {
  return (
    <main className="flex min-h-[70vh] items-center justify-center bg-[#fafafa]">
      <div className="text-center">
        <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-gray-200 border-t-[#279d5e]" />
        <p className="mt-4 text-sm text-gray-500">
          Loading your order...
        </p>
      </div>
    </main>
  );
}

export default function OrderConfirmationPage() {
  return (
    <Suspense fallback={<OrderConfirmationFallback />}>
      <OrderConfirmationContent />
    </Suspense>
  );
}
