
"use client";

import { useState, useSyncExternalStore, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

import {
  ArrowLeft,
  ArrowRight,
  ShoppingBag,
  MapPin,
  Truck,
  CreditCard,
  ShieldCheck,
  CheckCircle,
} from "lucide-react";

import { useAuth } from "@/context/AuthContext";

import {
  getCart,
  getCartSnapshot,
  getEmptyCartSnapshot,
  saveCart,
  subscribeToShopStorage,
} from "@/lib/shop-storage";

import {
  getOrdersSnapshot,
  saveOrders,
  type AdminOrder,
} from "@/lib/order-storage";

const DELIVERY_CHARGE = 50;

const formatPrice = (price: number) =>
  `Rs. ${price.toLocaleString("en-NP")}`;

export default function CheckoutPage() {
  const router = useRouter();
  const { user } = useAuth();

  const cart = useSyncExternalStore(
    subscribeToShopStorage,
    getCartSnapshot,
    getEmptyCartSnapshot
  );

 

  const [customerName, setCustomerName] = useState<string | undefined>();
  const [email, setEmail] = useState<string | undefined>();
  const [phone, setPhone] = useState<string | undefined>();
  const [address, setAddress] = useState<string | undefined>();
  const [city, setCity] = useState("");
  const [instructions, setInstructions] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  
  const customerNameValue = customerName ?? user?.name ?? "";
  const emailValue = email ?? user?.email ?? "";
  const phoneValue = phone ?? user?.phone ?? "";
  const addressValue = address ?? user?.address ?? "";

  const subtotal = cart.reduce(
    (total, item) => total + item.price * item.quantity,
    0
  );

  const deliveryCharge = DELIVERY_CHARGE;
  const total = subtotal + deliveryCharge;

  const handlePlaceOrder = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");

    if (isSubmitting) return;

    const currentCart = getCart();

    if (currentCart.length === 0) {
      setError("Your cart is empty. Please add products before checkout.");
      return;
    }

    if (
      !customerNameValue.trim() ||
      !emailValue.trim() ||
      !phoneValue.trim() ||
      !addressValue.trim() ||
      !city.trim()
    ) {
      setError("Please complete all required delivery details.");
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailValue.trim())) {
      setError("Please enter a valid email address.");
      return;
    }

    if (!/^[0-9+\-\s]{7,15}$/.test(phoneValue.trim())) {
      setError("Please enter a valid phone number.");
      return;
    }

    setIsSubmitting(true);

    try {
      const orderId = crypto.randomUUID();
      const now = new Date().toISOString();

      const currentSubtotal = currentCart.reduce(
        (sum, item) => sum + item.price * item.quantity,
        0
      );

      const newOrder: AdminOrder = {
        id: orderId,
        orderNumber: `MLT-${Date.now().toString().slice(-8)}`,

        customer: {
          name: customerNameValue.trim(),
          email: emailValue.trim(),
          phone: phoneValue.trim(),
          address: [
            addressValue.trim(),
            instructions.trim()
              ? `Instructions: ${instructions.trim()}`
              : "",
          ]
            .filter(Boolean)
            .join(" | "),
          city: city.trim(),
        },

        items: currentCart.map((item) => ({
          productId: item.id,
          name: item.name,
          image: item.image,
          price: item.price,
          quantity: item.quantity,
        })),

        subtotal: currentSubtotal,
        deliveryCharge,
        total: currentSubtotal + deliveryCharge,

        // Cash on Delivery is the only available payment method.
        paymentMethod: "CASH_ON_DELIVERY",
        paymentStatus: "UNPAID",

        status: "PENDING",

        createdAt: now,
        updatedAt: now,
      };

     
      const existingOrders = getOrdersSnapshot();
      saveOrders([...existingOrders, newOrder]);

   
      saveCart([]);

      router.push(
        `/order-confirmation?order=${encodeURIComponent(orderId)}`
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong. Please try again."
      );

      setIsSubmitting(false);
    }
  };

  
  if (cart.length === 0) {
    return (
      <main className="flex min-h-[75vh] items-center justify-center bg-[#fafafa] px-5 py-16">
        <div className="max-w-md text-center">
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-[#35C477]/10 text-[#279d5e]">
            <ShoppingBag size={36} />
          </div>

          <h1 className="text-3xl font-bold text-[#101A17]">
            Your cart is empty.
          </h1>

          <p className="mt-3 text-sm leading-7 text-gray-500">
            Add some products to your shopping cart before proceeding to
            checkout.
          </p>

          <Link
            href="/products"
            className="mt-7 inline-flex items-center gap-2 rounded-xl bg-[#101A17] px-6 py-3.5 text-sm font-semibold text-white transition hover:bg-[#279d5e]"
          >
            Start Shopping
            <ArrowRight size={17} />
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#fafafa] text-[#171717]">
      <section className="bg-[#101A17] px-5 py-12 text-white sm:px-8 sm:py-14">
        <div className="mx-auto max-w-7xl">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.3em] text-[#35C477]">
            Almost there
          </p>

          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
            Checkout<span className="text-[#35C477]">.</span>
          </h1>

          <p className="mt-3 text-sm text-gray-400">
            Complete your details and place your order.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-10 sm:px-8 lg:py-14">
        <Link
          href="/cart"
          className="mb-8 inline-flex items-center gap-2 text-sm font-semibold text-gray-500 transition hover:text-[#279d5e]"
        >
          <ArrowLeft size={17} />
          Back to Cart
        </Link>

        <form onSubmit={handlePlaceOrder}>
          <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-[1fr_380px]">
            <div className="space-y-6">
              <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm sm:p-7">
                <div className="mb-6 flex items-center gap-3">
                  <div className="rounded-xl bg-[#35C477]/10 p-3 text-[#279d5e]">
                    <MapPin size={21} />
                  </div>

                  <div>
                    <h2 className="text-lg font-bold text-[#101A17]">
                      Delivery Information
                    </h2>

                    <p className="mt-1 text-xs text-gray-500">
                      Where should we deliver your order?
                    </p>
                  </div>
                </div>

                <div className="grid gap-5 sm:grid-cols-2">
                  <FormField label="Full Name" required>
                    <input
                      type="text"
                      value={customerNameValue}
                      onChange={(event) =>
                        setCustomerName(event.target.value)
                      }
                      placeholder="Enter your full name"
                      autoComplete="name"
                      required
                      className="checkout-input"
                    />
                  </FormField>

                  <FormField label="Email Address" required>
                    <input
                      type="email"
                      value={emailValue}
                      onChange={(event) => setEmail(event.target.value)}
                      placeholder="example@email.com"
                      autoComplete="email"
                      required
                      className="checkout-input"
                    />
                  </FormField>

                  <FormField label="Phone Number" required>
                    <input
                      type="tel"
                      value={phoneValue}
                      onChange={(event) =>
                        setPhone(event.target.value)
                      }
                      placeholder="98XXXXXXXX"
                      autoComplete="tel"
                      required
                      className="checkout-input"
                    />
                  </FormField>

                  <FormField label="City / Municipality" required>
                    <input
                      type="text"
                      value={city}
                      onChange={(event) => setCity(event.target.value)}
                      placeholder="Kathmandu, Lalitpur..."
                      autoComplete="address-level2"
                      required
                      className="checkout-input"
                    />
                  </FormField>

                  <div className="sm:col-span-2">
                    <FormField label="Full Delivery Address" required>
                      <textarea
                        value={addressValue}
                        onChange={(event) =>
                          setAddress(event.target.value)
                        }
                        placeholder="House number, street, area, ward..."
                        rows={3}
                        autoComplete="street-address"
                        required
                        className="checkout-input resize-none"
                      />
                    </FormField>
                  </div>

                  <div className="sm:col-span-2">
                    <FormField label="Delivery Instructions (Optional)">
                      <textarea
                        value={instructions}
                        onChange={(event) =>
                          setInstructions(event.target.value)
                        }
                        placeholder="Any special instructions for delivery?"
                        rows={2}
                        className="checkout-input resize-none"
                      />
                    </FormField>
                  </div>
                </div>
              </section>

              <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm sm:p-7">
                <div className="mb-6 flex items-center gap-3">
                  <div className="rounded-xl bg-[#35C477]/10 p-3 text-[#279d5e]">
                    <CreditCard size={21} />
                  </div>

                  <div>
                    <h2 className="text-lg font-bold text-[#101A17]">
                      Payment Method
                    </h2>

                    <p className="mt-1 text-xs text-gray-500">
                      Currently available payment option.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 rounded-xl border border-[#279d5e] bg-[#35C477]/5 p-4">
                  <input
                    type="radio"
                    checked
                    readOnly
                    aria-label="Cash on Delivery"
                    className="mt-1 accent-[#279d5e]"
                  />

                  <div>
                    <p className="text-sm font-semibold text-[#101A17]">
                      Cash on Delivery
                    </p>

                    <p className="mt-1 text-xs leading-5 text-gray-500">
                      Pay in cash when your order is delivered to your
                      address.
                    </p>
                  </div>
                </div>

                <div className="mt-5 flex items-start gap-2 rounded-lg bg-gray-50 p-3 text-xs leading-5 text-gray-500">
                  <ShieldCheck
                    size={17}
                    className="mt-0.5 shrink-0 text-[#279d5e]"
                  />

                  You will pay the total amount when your order arrives.
                  No online payment is required.
                </div>
              </section>
            </div>

            <aside className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm lg:sticky lg:top-28 sm:p-6">
              <h2 className="text-xl font-bold text-[#101A17]">
                Your Order
              </h2>

              <p className="mt-1 text-xs text-gray-500">
                {cart.length} different product(s)
              </p>

              <div className="mt-6 max-h-[350px] space-y-4 overflow-y-auto">
                {cart.map((item) => (
                  <div key={item.id} className="flex gap-3">
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

                      <p className="mt-1 text-xs text-gray-500">
                        Quantity: {item.quantity}
                      </p>

                      <p className="mt-1 text-sm font-bold text-[#279d5e]">
                        {formatPrice(item.price * item.quantity)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-6 space-y-4 border-t border-gray-100 pt-5 text-sm">
                <div className="flex justify-between gap-3">
                  <span className="text-gray-500">Subtotal</span>
                  <span className="font-semibold text-[#101A17]">
                    {formatPrice(subtotal)}
                  </span>
                </div>

                <div className="flex justify-between gap-3">
                  <span className="text-gray-500">Delivery Charge</span>
                  <span className="font-semibold text-[#101A17]">
                    {formatPrice(deliveryCharge)}
                  </span>
                </div>

                <div className="flex justify-between gap-3 border-t border-gray-100 pt-5">
                  <span className="font-bold text-[#101A17]">
                    Total Amount
                  </span>

                  <span className="text-xl font-bold text-[#279d5e]">
                    {formatPrice(total)}
                  </span>
                </div>
              </div>

              {error && (
                <p
                  role="alert"
                  className="mt-5 rounded-lg bg-red-50 p-3 text-sm text-red-600"
                >
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={isSubmitting || cart.length === 0}
                className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-[#101A17] px-5 py-4 text-sm font-bold text-white transition hover:bg-[#279d5e] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSubmitting ? (
                  "Placing Order..."
                ) : (
                  <>
                    Place Order
                    <ArrowRight size={17} />
                  </>
                )}
              </button>

              <p className="mt-3 flex items-center justify-center gap-2 text-center text-xs text-gray-400">
                <CheckCircle size={14} className="text-[#279d5e]" />
                Pay when your order is delivered.
              </p>
            </aside>
          </div>
        </form>
        <div className="mt-8 flex items-start gap-3 rounded-xl border border-[#35C477]/20 bg-[#35C477]/5 p-4">
          <Truck
            size={20}
            className="mt-0.5 shrink-0 text-[#279d5e]"
          />

          <div>
            <p className="text-sm font-semibold text-[#101A17]">
              Delivery Information
            </p>

            <p className="mt-1 text-xs leading-5 text-gray-500">
              Your order will initially be marked as pending. Our team can
              confirm and update its delivery status from the admin panel.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}

function FormField({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <div>
      <label className="mb-2 block text-sm font-semibold text-gray-700">
        {label}
        {required && <span className="ml-1 text-red-500">*</span>}
      </label>

      {children}
    </div>
  );
}
