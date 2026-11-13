
"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  Eye,
  X,
  Package,
  Clock,
  CheckCircle,
  Banknote,
  CalendarDays,
  ShoppingBag,
} from "lucide-react";

import { useAuth } from "@/context/AuthContext";
import {
  getOrdersSnapshot,
  getServerOrdersSnapshot,
  subscribeToOrders,
  updateOrder,
  type AdminOrder,
  type OrderStatus,
} from "@/lib/order-storage";

const statusOptions: OrderStatus[] = [
  "PENDING",
  "CONFIRMED",
  "PROCESSING",
  "SHIPPED",
  "DELIVERED",
  "CANCELLED",
];

const statusStyles: Record<OrderStatus, string> = {
  PENDING: "bg-yellow-100 text-yellow-700",
  CONFIRMED: "bg-blue-100 text-blue-700",
  PROCESSING: "bg-purple-100 text-purple-700",
  SHIPPED: "bg-indigo-100 text-indigo-700",
  DELIVERED: "bg-green-100 text-green-700",
  CANCELLED: "bg-red-100 text-red-700",
};

const formatPrice = (amount: number) =>
  new Intl.NumberFormat("en-NP", {
    style: "currency",
    currency: "NPR",
    maximumFractionDigits: 0,
  }).format(amount);

const formatDate = (date: string) =>
  new Date(date).toLocaleDateString("en-NP", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

export default function AdminOrdersPage() {
  const router = useRouter();
  const { user, isLoading } = useAuth();

  const orders = useSyncExternalStore(
    subscribeToOrders,
    getOrdersSnapshot,
    getServerOrdersSnapshot,
  );

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [dateFilter, setDateFilter] = useState("");
  const [selectedOrder, setSelectedOrder] = useState<AdminOrder | null>(null);

  useEffect(() => {
    if (!isLoading && (!user || user.role !== "admin")) {
      router.replace("/login");
    }
  }, [user, isLoading, router]);

  const today = new Date().toLocaleDateString("en-CA");

  const todayOrders = orders.filter(
    (order) => new Date(order.createdAt).toLocaleDateString("en-CA") === today,
  );

  const pendingOrders = orders.filter(
    (order) => order.status === "PENDING",
  );

  const totalRevenue = orders
    .filter((order) => order.paymentStatus === "PAID")
    .reduce((total, order) => total + order.total, 0);

  const filteredOrders = useMemo(() => {
    return orders
      .filter((order) => {
        const searchValue = search.toLowerCase();

        const matchesSearch =
          order.orderNumber.toLowerCase().includes(searchValue) ||
          order.customer.name.toLowerCase().includes(searchValue) ||
          order.customer.email.toLowerCase().includes(searchValue) ||
          order.customer.phone.includes(searchValue);

        const matchesStatus =
          statusFilter === "ALL" || order.status === statusFilter;

        const matchesDate =
          !dateFilter ||
          new Date(order.createdAt).toLocaleDateString("en-CA") ===
            dateFilter;

        return matchesSearch && matchesStatus && matchesDate;
      })
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() -
          new Date(a.createdAt).getTime(),
      );
  }, [orders, search, statusFilter, dateFilter]);

  const handleStatusChange = (
    orderId: string,
    status: OrderStatus,
  ) => {
    updateOrder(orderId, { status });

    if (selectedOrder?.id === orderId) {
      setSelectedOrder((previous) =>
        previous ? { ...previous, status } : null,
      );
    }
  };

  const handlePaymentChange = (order: AdminOrder) => {
    const paymentStatus =
      order.paymentStatus === "PAID" ? "UNPAID" : "PAID";

    updateOrder(order.id, { paymentStatus });

    setSelectedOrder((previous) =>
      previous?.id === order.id
        ? { ...previous, paymentStatus }
        : previous,
    );
  };

  const handleDeliveryDateChange = (
    orderId: string,
    estimatedDeliveryDate: string,
  ) => {
    updateOrder(orderId, { estimatedDeliveryDate });

    setSelectedOrder((previous) =>
      previous?.id === orderId
        ? { ...previous, estimatedDeliveryDate }
        : previous,
    );
  };

  if (isLoading || !user || user.role !== "admin") {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-sm text-gray-500">Loading orders...</p>
      </div>
    );
  }

  return (
    <div className="space-y-7 px-0 sm:px-4 lg:px-8">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Orders Management
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage customer orders, payments and deliveries.
          </p>
        </div>

        <div className="flex items-center gap-2 text-sm text-gray-500">
          <ShoppingBag size={17} />
          {orders.length} Total Orders
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Total Orders"
          value={orders.length.toString()}
          icon={<Package size={21} />}
          color="bg-blue-50 text-blue-600"
        />

        <StatCard
          title="Orders Today"
          value={todayOrders.length.toString()}
          icon={<CalendarDays size={21} />}
          color="bg-purple-50 text-purple-600"
        />

        <StatCard
          title="Pending Orders"
          value={pendingOrders.length.toString()}
          icon={<Clock size={21} />}
          color="bg-yellow-50 text-yellow-600"
        />

        <StatCard
          title="Paid Revenue"
          value={formatPrice(totalRevenue)}
          icon={<Banknote size={21} />}
          color="bg-green-50 text-green-600"
        />
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <div className="relative">
            <Search
              size={18}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
            />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search order, customer or phone..."
              className="w-full rounded-lg border border-gray-200 py-2.5 pl-10 pr-3 text-sm outline-none focus:border-green-600"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            className="rounded-lg border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-green-600"
          >
            <option value="ALL">All Statuses</option>
            {statusOptions.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>

          <input
            type="date"
            value={dateFilter}
            onChange={(event) => setDateFilter(event.target.value)}
            className="rounded-lg border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-green-600"
          />
        </div>

        <div className="mt-3 flex justify-between text-xs text-gray-500">
          <span>{filteredOrders.length} orders found</span>

          <button
            onClick={() => {
              setSearch("");
              setStatusFilter("ALL");
              setDateFilter("");
            }}
            className="font-medium text-green-700 hover:underline"
          >
            Clear filters
          </button>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[950px] text-left">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500">
              <tr>
                <th className="px-5 py-4">Order</th>
                <th className="px-5 py-4">Customer</th>
                <th className="px-5 py-4">Date</th>
                <th className="px-5 py-4">Total</th>
                <th className="px-5 py-4">Payment</th>
                <th className="px-5 py-4">Status</th>
                <th className="px-5 py-4 text-right">Action</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-100">
              {filteredOrders.map((order) => (
                <tr key={order.id} className="hover:bg-gray-50">
                  <td className="px-5 py-4">
                    <p className="font-semibold text-gray-900">
                      {order.orderNumber}
                    </p>
                    <p className="mt-1 text-xs text-gray-500">
                      {order.items.length} product(s)
                    </p>
                  </td>

                  <td className="px-5 py-4">
                    <p className="font-medium text-gray-800">
                      {order.customer.name}
                    </p>
                    <p className="mt-1 text-xs text-gray-500">
                      {order.customer.phone}
                    </p>
                  </td>

                  <td className="px-5 py-4 text-sm text-gray-600">
                    {formatDate(order.createdAt)}
                  </td>

                  <td className="px-5 py-4 font-semibold text-gray-900">
                    {formatPrice(order.total)}
                  </td>

                  <td className="px-5 py-4">
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                        order.paymentStatus === "PAID"
                          ? "bg-green-100 text-green-700"
                          : "bg-orange-100 text-orange-700"
                      }`}
                    >
                      {order.paymentStatus}
                    </span>
                  </td>

                  <td className="px-5 py-4">
                    <select
                      value={order.status}
                      onChange={(event) =>
                        handleStatusChange(
                          order.id,
                          event.target.value as OrderStatus,
                        )
                      }
                      className={`rounded-full border-0 px-3 py-1.5 text-xs font-semibold outline-none ${
                        statusStyles[order.status]
                      }`}
                    >
                      {statusOptions.map((status) => (
                        <option key={status} value={status}>
                          {status}
                        </option>
                      ))}
                    </select>
                  </td>

                  <td className="px-5 py-4 text-right">
                    <button
                      onClick={() => setSelectedOrder(order)}
                      className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 hover:border-green-600 hover:text-green-700"
                    >
                      <Eye size={16} />
                      View
                    </button>
                  </td>
                </tr>
              ))}

              {filteredOrders.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-5 py-14 text-center">
                    <Package
                      size={35}
                      className="mx-auto mb-3 text-gray-300"
                    />
                    <p className="font-medium text-gray-700">
                      No orders found
                    </p>
                    <p className="mt-1 text-sm text-gray-500">
                      Try changing your search or filters.
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3 sm:p-5">
          <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white shadow-xl">
            <div className="sticky top-0 flex items-center justify-between border-b border-gray-100 bg-white px-5 py-4">
              <div>
                <h2 className="text-lg font-bold text-gray-900">
                  Order Details
                </h2>
                <p className="text-sm text-gray-500">
                  {selectedOrder.orderNumber}
                </p>
              </div>

              <button
                onClick={() => setSelectedOrder(null)}
                className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"
                aria-label="Close order details"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-6 p-5">
              <section>
                <h3 className="mb-3 font-semibold text-gray-900">
                  Customer Information
                </h3>

                <div className="grid gap-3 rounded-xl bg-gray-50 p-4 text-sm sm:grid-cols-2">
                  <Info label="Name" value={selectedOrder.customer.name} />
                  <Info label="Email" value={selectedOrder.customer.email} />
                  <Info label="Phone" value={selectedOrder.customer.phone} />
                  <Info
                    label="Address"
                    value={`${selectedOrder.customer.address}, ${selectedOrder.customer.city}`}
                  />
                </div>
              </section>

              <section>
                <h3 className="mb-3 font-semibold text-gray-900">
                  Ordered Products
                </h3>

                <div className="space-y-3">
                  {selectedOrder.items.map((item, index) => (
                    <div
                      key={`${item.productId}-${index}`}
                      className="flex items-center gap-3 rounded-xl border border-gray-100 p-3"
                    >
                      <img
                        src={item.image}
                        alt={item.name}
                        className="h-14 w-14 rounded-lg bg-gray-100 object-cover"
                      />

                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-gray-900">
                          {item.name}
                        </p>
                        {item.nameNp && (
                          <p className="text-sm text-gray-500">
                            {item.nameNp}
                          </p>
                        )}
                        <p className="text-xs text-gray-500">
                          {formatPrice(item.price)} × {item.quantity}
                        </p>
                      </div>

                      <p className="font-semibold text-gray-900">
                        {formatPrice(item.price * item.quantity)}
                      </p>
                    </div>
                  ))}
                </div>

                <div className="ml-auto mt-4 max-w-xs space-y-2 text-sm">
                  <div className="flex justify-between text-gray-600">
                    <span>Subtotal</span>
                    <span>{formatPrice(selectedOrder.subtotal)}</span>
                  </div>

                  <div className="flex justify-between text-gray-600">
                    <span>Delivery</span>
                    <span>{formatPrice(selectedOrder.deliveryCharge)}</span>
                  </div>

                  <div className="flex justify-between border-t border-gray-200 pt-3 text-base font-bold text-gray-900">
                    <span>Total</span>
                    <span>{formatPrice(selectedOrder.total)}</span>
                  </div>
                </div>
              </section>

              <section className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-gray-700">
                    Order Status
                  </label>

                  <select
                    value={selectedOrder.status}
                    onChange={(event) =>
                      handleStatusChange(
                        selectedOrder.id,
                        event.target.value as OrderStatus,
                      )
                    }
                    className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-green-600"
                  >
                    {statusOptions.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-gray-700">
                    Payment Status
                  </label>

                  <button
                    onClick={() => handlePaymentChange(selectedOrder)}
                    className={`w-full rounded-lg px-3 py-2.5 text-sm font-semibold ${
                      selectedOrder.paymentStatus === "PAID"
                        ? "bg-green-100 text-green-700"
                        : "bg-orange-100 text-orange-700"
                    }`}
                  >
                    {selectedOrder.paymentStatus === "PAID"
                      ? "Mark as Unpaid"
                      : "Mark as Paid"}
                  </button>
                </div>
              </section>

              <section>
                <label className="mb-2 block text-sm font-semibold text-gray-700">
                  Estimated Delivery Date
                </label>

                <input
                  type="date"
                  value={selectedOrder.estimatedDeliveryDate ?? ""}
                  onChange={(event) =>
                    handleDeliveryDateChange(
                      selectedOrder.id,
                      event.target.value,
                    )
                  }
                  className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-green-600 sm:max-w-xs"
                />
              </section>

              <div className="rounded-lg bg-gray-50 p-3 text-xs text-gray-500">
                <p>Payment method: {selectedOrder.paymentMethod.replaceAll("_", " ")}</p>
                <p className="mt-1">
                  Order placed: {formatDate(selectedOrder.createdAt)}
                </p>
                {selectedOrder.estimatedDeliveryDate && (
                  <p className="mt-1">
                    Estimated delivery: {formatDate(selectedOrder.estimatedDeliveryDate)}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({
  title,
  value,
  icon,
  color,
}: {
  title: string;
  value: string;
  icon: React.ReactNode;
  color: string;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">{title}</p>
        <div className={`rounded-lg p-2.5 ${color}`}>{icon}</div>
      </div>
      <p className="mt-4 text-2xl font-bold text-gray-900">{value}</p>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-gray-500">{label}</p>
      <p className="mt-1 break-words font-medium text-gray-800">{value}</p>
    </div>
  );
}
