
"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import {
  Package,
  Search,
  ShoppingBag,
  CalendarDays,
  MapPin,
  Phone,
  ChevronDown,
  ChevronUp,
  ArrowRight,
  Clock,
  CheckCircle2,
  Truck,
  XCircle,
} from "lucide-react";

import { useAuth } from "@/context/AuthContext";

import {
  getOrdersSnapshot,
  getServerOrdersSnapshot,
  subscribeToOrders,
  type AdminOrder,
  type OrderStatus,
} from "@/lib/order-storage";

const formatPrice = (price: number) =>
  `Rs. ${price.toLocaleString("en-NP")}`;

const statusStyles: Record<OrderStatus, string> = {
  PENDING: "bg-yellow-50 text-yellow-700",
  CONFIRMED: "bg-blue-50 text-blue-700",
  PROCESSING: "bg-purple-50 text-purple-700",
  SHIPPED: "bg-indigo-50 text-indigo-700",
  DELIVERED: "bg-green-50 text-green-700",
  CANCELLED: "bg-red-50 text-red-700",
};

const statusIcons: Record<OrderStatus, typeof Clock> = {
  PENDING: Clock,
  CONFIRMED: CheckCircle2,
  PROCESSING: Package,
  SHIPPED: Truck,
  DELIVERED: CheckCircle2,
  CANCELLED: XCircle,
};

const statusDescriptions: Record<OrderStatus, string> = {
  PENDING: "Your order is waiting for confirmation.",
  CONFIRMED: "Your order has been confirmed.",
  PROCESSING: "Your items are being prepared.",
  SHIPPED: "Your order is on its way.",
  DELIVERED: "Your order has been delivered.",
  CANCELLED: "This order has been cancelled.",
};

export default function MyOrdersPage() {
  const { user, isLoading: authLoading } = useAuth();

  const orders = useSyncExternalStore(
    subscribeToOrders,
    getOrdersSnapshot,
    getServerOrdersSnapshot,
  );

  const [searchEmail, setSearchEmail] = useState("");
  const [submittedEmail, setSubmittedEmail] = useState("");
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);
  const [selectedStatus, setSelectedStatus] = useState("ALL");

  const customerEmail = user?.email || submittedEmail;

  const customerOrders = useMemo(() => {
    if (!customerEmail) return [];

    return orders
      .filter(
        (order) =>
          order.customer.email.toLowerCase() ===
          customerEmail.trim().toLowerCase(),
      )
      .filter(
        (order) =>
          selectedStatus === "ALL" || order.status === selectedStatus,
      )
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() -
          new Date(a.createdAt).getTime(),
      );
  }, [orders, customerEmail, selectedStatus]);

  const handleEmailSearch = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmittedEmail(searchEmail.trim());
  };

  if (authLoading) {
    return (
      <main className="flex min-h-[70vh] items-center justify-center bg-[#fafafa]">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-gray-200 border-t-[#279d5e]" />
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#fafafa]">
      
      <section className="bg-[#101A17] px-5 py-12 text-white sm:px-8 sm:py-14">
        <div className="mx-auto max-w-7xl">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.3em] text-[#35C477]">
            Your shopping activity
          </p>

          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
            My Orders<span className="text-[#35C477]">.</span>
          </h1>

          <p className="mt-3 text-sm text-gray-400">
            View and track all your Malta purchases.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-5 py-10 sm:px-8 lg:py-14">
        
        {!user && (
          <div className="mb-8 rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-bold text-[#101A17]">
              Find Your Orders
            </h2>

            <p className="mt-2 text-sm text-gray-500">
              Enter the email address you used when placing your order.
            </p>

            <form
              onSubmit={handleEmailSearch}
              className="mt-5 flex flex-col gap-3 sm:flex-row"
            >
              <input
                type="email"
                value={searchEmail}
                onChange={(event) => setSearchEmail(event.target.value)}
                placeholder="Enter your email address"
                required
                className="min-w-0 flex-1 rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none transition focus:border-[#279d5e]"
              />

              <button
                type="submit"
                className="flex items-center justify-center gap-2 rounded-xl bg-[#101A17] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#279d5e]"
              >
                <Search size={17} />
                Find Orders
              </button>
            </form>
          </div>
        )}

        
        {user && (
          <div className="mb-8 flex flex-col justify-between gap-3 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm sm:flex-row sm:items-center">
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-gray-400">
                Orders belonging to
              </p>
              <p className="mt-1 text-sm font-bold text-[#101A17]">
                {user.email}
              </p>
            </div>

            <Link
              href="/account"
              className="text-sm font-semibold text-[#279d5e] hover:underline"
            >
              My Account
            </Link>
          </div>
        )}

       
        {customerEmail && (
          <>
            <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
              <div>
                <h2 className="text-xl font-bold text-[#101A17]">
                  Order History
                </h2>

                <p className="mt-1 text-sm text-gray-500">
                  {customerOrders.length} order(s) found
                </p>
              </div>

              <select
                value={selectedStatus}
                onChange={(event) => setSelectedStatus(event.target.value)}
                className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none focus:border-[#279d5e]"
              >
                <option value="ALL">All Orders</option>
                <option value="PENDING">Pending</option>
                <option value="CONFIRMED">Confirmed</option>
                <option value="PROCESSING">Processing</option>
                <option value="SHIPPED">Shipped</option>
                <option value="DELIVERED">Delivered</option>
                <option value="CANCELLED">Cancelled</option>
              </select>
            </div>

            {customerOrders.length === 0 ? (
              <EmptyOrders />
            ) : (
              <div className="space-y-5">
                {customerOrders.map((order) => (
                  <OrderCard
                    key={order.id}
                    order={order}
                    expanded={expandedOrder === order.id}
                    onToggle={() =>
                      setExpandedOrder(
                        expandedOrder === order.id ? null : order.id,
                      )
                    }
                  />
                ))}
              </div>
            )}
          </>
        )}

        
        {!user && !submittedEmail && (
          <div className="rounded-2xl border border-gray-100 bg-white px-6 py-14 text-center shadow-sm">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#35C477]/10 text-[#279d5e]">
              <Package size={30} />
            </div>

            <h2 className="mt-5 text-xl font-bold text-[#101A17]">
              Find Your Orders
            </h2>

            <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-gray-500">
              Enter your checkout email above to see your previous purchases
              and track their delivery status.
            </p>
          </div>
        )}

       
        <div className="mt-10 text-center">
          <Link
            href="/products"
            className="inline-flex items-center gap-2 text-sm font-semibold text-[#279d5e] transition hover:gap-3"
          >
            Continue Shopping
            <ArrowRight size={17} />
          </Link>
        </div>
      </section>
    </main>
  );
}

function OrderCard({
  order,
  expanded,
  onToggle,
}: {
  order: AdminOrder;
  expanded: boolean;
  onToggle: () => void;
}) {
  const StatusIcon = statusIcons[order.status];

  return (
    <article className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
     
      <div className="p-5 sm:p-6">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-gray-400">
              Order Number
            </p>

            <h3 className="mt-1 text-lg font-bold text-[#101A17]">
              {order.orderNumber}
            </h3>

            <p className="mt-2 flex items-center gap-2 text-xs text-gray-500">
              <CalendarDays size={14} />
              {new Date(order.createdAt).toLocaleDateString("en-NP", {
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <span
              className={`inline-flex items-center gap-2 rounded-full px-3 py-2 text-xs font-bold ${statusStyles[order.status]}`}
            >
              <StatusIcon size={14} />
              {order.status}
            </span>

            <p className="text-lg font-bold text-[#279d5e]">
              {formatPrice(order.total)}
            </p>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 pt-5">
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <ShoppingBag size={15} />
            {order.items.reduce((total, item) => total + item.quantity, 0)}{" "}
            item(s)
            <span className="text-gray-300">|</span>
            Cash on Delivery
          </div>

          <button
            type="button"
            onClick={onToggle}
            className="flex items-center gap-2 text-sm font-semibold text-[#279d5e] transition hover:text-[#101A17]"
          >
            {expanded ? "Hide Details" : "View Details"}
            {expanded ? (
              <ChevronUp size={17} />
            ) : (
              <ChevronDown size={17} />
            )}
          </button>
        </div>
      </div>

     
      {expanded && (
        <div className="border-t border-gray-100 bg-[#fafafa] p-5 sm:p-6">
          
          <div className="mb-6 rounded-xl border border-gray-100 bg-white p-4">
            <div className="flex items-center gap-2">
              <StatusIcon size={18} className="text-[#279d5e]" />
              <p className="text-sm font-bold text-[#101A17]">
                {order.status}
              </p>
            </div>

            <p className="mt-2 text-xs leading-5 text-gray-500">
              {statusDescriptions[order.status]}
            </p>

            {order.estimatedDeliveryDate && (
              <p className="mt-3 text-xs font-semibold text-[#279d5e]">
                Estimated delivery:{" "}
                {new Date(
                  `${order.estimatedDeliveryDate}T00:00:00`,
                ).toLocaleDateString("en-NP", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </p>
            )}
          </div>

         
          <h4 className="mb-4 text-sm font-bold text-[#101A17]">
            Products Ordered
          </h4>

          <div className="space-y-4">
            {order.items.map((item, index) => (
              <div
                key={`${item.productId}-${index}`}
                className="flex items-center gap-3"
              >
                <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-white">
                  <img
                    src={item.image}
                    alt={item.name}
                    className="h-full w-full object-cover"
                  />
                </div>

                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-[#101A17]">
                    {item.name}
                  </p>
                  <p className="mt-1 text-xs text-gray-500">
                    {formatPrice(item.price)} × {item.quantity}
                  </p>
                </div>

                <p className="shrink-0 text-sm font-bold text-[#101A17]">
                  {formatPrice(item.price * item.quantity)}
                </p>
              </div>
            ))}
          </div>

          
          <div className="mt-6 space-y-3 border-t border-gray-200 pt-5 text-sm">
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

            <div className="flex justify-between border-t border-gray-200 pt-4">
              <span className="font-bold text-[#101A17]">Total</span>
              <span className="text-lg font-bold text-[#279d5e]">
                {formatPrice(order.total)}
              </span>
            </div>
          </div>

          
          <div className="mt-6 rounded-xl border border-gray-100 bg-white p-4">
            <h4 className="mb-4 text-sm font-bold text-[#101A17]">
              Delivery Information
            </h4>

            <div className="flex items-start gap-3">
              <MapPin size={17} className="mt-0.5 text-gray-400" />
              <div>
                <p className="text-xs font-semibold text-[#101A17]">
                  Address
                </p>
                <p className="mt-1 text-xs leading-5 text-gray-500">
                  {order.customer.address}
                  <br />
                  {order.customer.city}
                </p>
              </div>
            </div>

            <div className="mt-4 flex items-center gap-3">
              <Phone size={17} className="text-gray-400" />
              <div>
                <p className="text-xs font-semibold text-[#101A17]">
                  Phone
                </p>
                <p className="mt-1 text-xs text-gray-500">
                  {order.customer.phone}
                </p>
              </div>
            </div>
          </div>

          
          <div className="mt-4 flex items-center justify-between rounded-xl border border-gray-100 bg-white p-4">
            <div>
              <p className="text-sm font-semibold text-[#101A17]">
                Cash on Delivery
              </p>
              <p className="mt-1 text-xs text-gray-500">
                Payment status
              </p>
            </div>

            <span
              className={`rounded-full px-3 py-2 text-xs font-bold ${
                order.paymentStatus === "PAID"
                  ? "bg-green-50 text-green-700"
                  : "bg-yellow-50 text-yellow-700"
              }`}
            >
              {order.paymentStatus}
            </span>
          </div>
        </div>
      )}
    </article>
  );
}

function EmptyOrders() {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white px-6 py-14 text-center shadow-sm">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-gray-100 text-gray-400">
        <Package size={30} />
      </div>

      <h2 className="mt-5 text-xl font-bold text-[#101A17]">
        No Orders Found
      </h2>

      <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-gray-500">
        {`We couldn't find any orders for this email and status filter.
        Try another filter or start shopping.`}
      </p>

      <Link
        href="/products"
        className="mt-6 inline-flex items-center gap-2 rounded-xl bg-[#101A17] px-6 py-3.5 text-sm font-semibold text-white transition hover:bg-[#279d5e]"
      >
        Start Shopping
        <ArrowRight size={17} />
      </Link>
    </div>
  );
}
