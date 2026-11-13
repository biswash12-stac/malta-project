
"use client";

import {useMemo} from "react";
import Link from "next/link";
import {
  IndianRupee,
  ShoppingBag,
  Clock,
  Package,
  ArrowUpRight,
  ArrowRight,
  TrendingUp,
  Users,
  CheckCircle2,
  Truck,
  XCircle,
  Plus,
  Eye,
} from "lucide-react";

import { useProducts } from "@/hooks/useProducts";

type OrderStatus =
  | "Pending"
  | "Confirmed"
  | "Processing"
  | "Shipped"
  | "Delivered"
  | "Cancelled";

type DemoOrder = {
  id: string;
  customer: string;
  phone: string;
  date: string;
  total: number;
  status: OrderStatus;
  paid: boolean;
  items: number;
};

const demoOrders: DemoOrder[] = [
  {
    id: "MLT-1005",
    customer: "Aarav Sharma",
    phone: "9800000001",
    date: "today",
    total: 2450,
    status: "Pending",
    paid: false,
    items: 4,
  },
  {
    id: "MLT-1004",
    customer: "Sita Thapa",
    phone: "9800000002",
    date: "today",
    total: 1850,
    status: "Confirmed",
    paid: true,
    items: 3,
  },
  {
    id: "MLT-1003",
    customer: "Ramesh Karki",
    phone: "9800000003",
    date: "yesterday",
    total: 3200,
    status: "Processing",
    paid: true,
    items: 6,
  },
  {
    id: "MLT-1002",
    customer: "Anita Gurung",
    phone: "9800000004",
    date: "yesterday",
    total: 950,
    status: "Shipped",
    paid: true,
    items: 2,
  },
  {
    id: "MLT-1001",
    customer: "Bikash Rai",
    phone: "9800000005",
    date: "older",
    total: 4100,
    status: "Delivered",
    paid: true,
    items: 8,
  },
];

const statusStyles: Record<OrderStatus, string> = {
  Pending: "bg-amber-50 text-amber-700",
  Confirmed: "bg-blue-50 text-blue-700",
  Processing: "bg-purple-50 text-purple-700",
  Shipped: "bg-indigo-50 text-indigo-700",
  Delivered: "bg-green-50 text-green-700",
  Cancelled: "bg-red-50 text-red-700",
};

function formatCurrency(amount: number) {
  return `Rs. ${amount.toLocaleString("en-IN")}`;
}

function StatCard({
  title,
  value,
  description,
  icon: Icon,
  iconStyle,
}: {
  title: string;
  value: string;
  description: string;
  icon: React.ElementType;
  iconStyle: string;
}) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition hover:shadow-md">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-500">{title}</p>
          <h3 className="mt-3 text-2xl font-bold text-gray-900 sm:text-3xl">
            {value}
          </h3>
        </div>

        <div className={`rounded-xl p-3 ${iconStyle}`}>
          <Icon size={23} />
        </div>
      </div>

      <p className="mt-4 text-xs text-gray-500">{description}</p>
    </div>
  );
}

export default function AdminDashboard() {
  const products = useProducts();

 
const todayKey = useMemo(() => {
  const now = new Date();

  return [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("-");
}, []);

const orders = useMemo(() => {
  return demoOrders.map((order) => {
    let dateOffset = 0;

    if (order.date === "yesterday") dateOffset = 1;
    if (order.date === "older") dateOffset = 3;

    const date = new Date(`${todayKey}T12:00:00`);
    date.setDate(date.getDate() - dateOffset);

    const dateString = [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, "0"),
      String(date.getDate()).padStart(2, "0"),
    ].join("-");

    return {
      ...order,
      date: dateString,
    };
  });
}, [todayKey]);

  const statistics = useMemo(() => {
    const todayOrders = orders.filter(
      (order) => order.date === todayKey
    );

    const pendingOrders = orders.filter(
      (order) => order.status === "Pending"
    );

    const totalRevenue = orders
      .filter(
        (order) =>
          order.paid && order.status !== "Cancelled"
      )
      .reduce((total, order) => total + order.total, 0);

    return {
      revenue: totalRevenue,
      todayOrders: todayOrders.length,
      pendingOrders: pendingOrders.length,
      totalProducts: products.length,
    };
  }, [orders, todayKey, products]);

  const statusCounts = useMemo(() => {
    const statuses: OrderStatus[] = [
      "Pending",
      "Confirmed",
      "Processing",
      "Shipped",
      "Delivered",
      "Cancelled",
    ];

    return statuses.map((status) => ({
      status,
      count: orders.filter(
        (order) => order.status === status
      ).length,
    }));
  }, [orders]);

  const recentOrders = [...orders].slice(0, 5);

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-7 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">

        <div className="mb-8 flex flex-col justify-between gap-5 sm:flex-row sm:items-center">
          <div>
            <p className="text-sm font-semibold text-green-700">
              OVERVIEW
            </p>

            <h1 className="mt-2 text-2xl font-bold text-gray-900 sm:text-3xl">
              Dashboard
            </h1>

            <p className="mt-2 text-sm text-gray-500">
              Welcome to your Malta store management dashboard.
            </p>
          </div>

          <Link
            href="/admin/products"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-green-700 px-5 py-3 text-sm font-semibold text-white transition hover:bg-green-800"
          >
            <Plus size={18} />
            Add New Product
          </Link>
        </div>

        <div className="mb-7 flex items-start gap-3 rounded-xl border border-blue-100 bg-blue-50 p-4">
          <TrendingUp size={20} className="mt-0.5 shrink-0 text-blue-600" />
          <div>
            <p className="text-sm font-semibold text-blue-900">
              Frontend preview mode
            </p>
            <p className="mt-1 text-xs leading-5 text-blue-700">
              Order and revenue figures currently use sample data.
              They will be connected to your backend when it is ready.
            </p>
          </div>
        </div>

        <section>
          <div className="mb-5">
            <h2 className="text-lg font-bold text-gray-900">
              Store Statistics
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              An overview of your store activity.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              title="Total Revenue"
              value={formatCurrency(statistics.revenue)}
              description="From paid demo orders"
              icon={IndianRupee}
              iconStyle="bg-green-50 text-green-700"
            />

            <StatCard
              title="Today's Orders"
              value={String(statistics.todayOrders)}
              description="Orders placed today"
              icon={ShoppingBag}
              iconStyle="bg-blue-50 text-blue-700"
            />

            <StatCard
              title="Pending Orders"
              value={String(statistics.pendingOrders)}
              description="Awaiting confirmation"
              icon={Clock}
              iconStyle="bg-amber-50 text-amber-700"
            />

            <StatCard
              title="Total Products"
              value={String(statistics.totalProducts)}
              description="Products in your catalog"
              icon={Package}
              iconStyle="bg-purple-50 text-purple-700"
            />
          </div>
        </section>

        <div className="mt-9 grid grid-cols-1 gap-6 xl:grid-cols-[1.6fr_1fr]">

          <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-gray-100 p-5">
              <div>
                <h2 className="font-bold text-gray-900">
                  Recent Orders
                </h2>
                <p className="mt-1 text-xs text-gray-500">
                  Latest customer orders
                </p>
              </div>

              <Link
                href="/admin/orders"
                className="flex items-center gap-1 text-sm font-semibold text-green-700 hover:text-green-900"
              >
                View All
                <ArrowUpRight size={16} />
              </Link>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[620px] text-left">
                <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                  <tr>
                    <th className="px-5 py-4">Order</th>
                    <th className="px-5 py-4">Customer</th>
                    <th className="px-5 py-4">Total</th>
                    <th className="px-5 py-4">Status</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-gray-100">
                  {recentOrders.map((order) => (
                    <tr key={order.id} className="hover:bg-gray-50">
                      <td className="px-5 py-4">
                        <p className="text-sm font-semibold text-gray-900">
                          {order.id}
                        </p>
                        <p className="mt-1 text-xs text-gray-400">
                          {order.items} items
                        </p>
                      </td>

                      <td className="px-5 py-4">
                        <p className="text-sm font-medium text-gray-800">
                          {order.customer}
                        </p>
                        <p className="mt-1 text-xs text-gray-400">
                          {order.phone}
                        </p>
                      </td>

                      <td className="px-5 py-4 text-sm font-semibold text-gray-900">
                        {formatCurrency(order.total)}
                      </td>

                      <td className="px-5 py-4">
                        <span
                          className={`rounded-full px-3 py-1.5 text-xs font-semibold ${statusStyles[order.status]}`}
                        >
                          {order.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="border-t border-gray-100 p-4">
              <Link
                href="/admin/orders"
                className="flex items-center justify-center gap-2 text-sm font-semibold text-gray-600 hover:text-green-700"
              >
                Manage all orders
                <ArrowRight size={16} />
              </Link>
            </div>
          </section>

          <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="mb-6">
              <h2 className="font-bold text-gray-900">
                Order Status
              </h2>
              <p className="mt-1 text-xs text-gray-500">
                Current order distribution
              </p>
            </div>

            <div className="space-y-5">
              {statusCounts.map((item) => {
                const percentage =
                  orders.length > 0
                    ? (item.count / orders.length) * 100
                    : 0;

                return (
                  <div key={item.status}>
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-600">
                        {item.status}
                      </span>
                      <span className="text-sm font-bold text-gray-900">
                        {item.count}
                      </span>
                    </div>

                    <div className="h-2 overflow-hidden rounded-full bg-gray-100">
                      <div
                        className="h-full rounded-full bg-green-600 transition-all"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            <Link
              href="/admin/orders"
              className="mt-7 flex items-center justify-center gap-2 rounded-xl border border-gray-200 py-3 text-sm font-semibold text-gray-700 transition hover:border-green-600 hover:text-green-700"
            >
              View Orders
              <ArrowRight size={16} />
            </Link>
          </section>
        </div>

        <section className="mt-9">
          <h2 className="mb-5 text-lg font-bold text-gray-900">
            Quick Actions
          </h2>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">

            <Link
              href="/admin/products"
              className="flex items-center gap-4 rounded-2xl border border-gray-200 bg-white p-5 transition hover:border-green-300 hover:shadow-sm"
            >
              <div className="rounded-xl bg-green-50 p-3 text-green-700">
                <Plus size={22} />
              </div>
              <div>
                <p className="text-sm font-bold text-gray-900">
                  Add Product
                </p>
                <p className="mt-1 text-xs text-gray-500">
                  Create a new product
                </p>
              </div>
            </Link>

            <Link
              href="/admin/orders"
              className="flex items-center gap-4 rounded-2xl border border-gray-200 bg-white p-5 transition hover:border-blue-300 hover:shadow-sm"
            >
              <div className="rounded-xl bg-blue-50 p-3 text-blue-700">
                <Eye size={22} />
              </div>
              <div>
                <p className="text-sm font-bold text-gray-900">
                  View Orders
                </p>
                <p className="mt-1 text-xs text-gray-500">
                  Review customer orders
                </p>
              </div>
            </Link>

            <Link
              href="/admin/categories"
              className="flex items-center gap-4 rounded-2xl border border-gray-200 bg-white p-5 transition hover:border-purple-300 hover:shadow-sm"
            >
              <div className="rounded-xl bg-purple-50 p-3 text-purple-700">
                <Package size={22} />
              </div>
              <div>
                <p className="text-sm font-bold text-gray-900">
                  Categories
                </p>
                <p className="mt-1 text-xs text-gray-500">
                  Organize your products
                </p>
              </div>
            </Link>

            <Link
              href="/admin/settings"
              className="flex items-center gap-4 rounded-2xl border border-gray-200 bg-white p-5 transition hover:border-orange-300 hover:shadow-sm"
            >
              <div className="rounded-xl bg-orange-50 p-3 text-orange-700">
                <Users size={22} />
              </div>
              <div>
                <p className="text-sm font-bold text-gray-900">
                  Account Settings
                </p>
                <p className="mt-1 text-xs text-gray-500">
                  Manage admin account
                </p>
              </div>
            </Link>
          </div>
        </section>

        <footer className="mt-10 border-t border-gray-200 py-6 text-center text-xs text-gray-400">
          Malta Admin Panel · Frontend Preview
        </footer>
      </div>
    </div>
  );
}
