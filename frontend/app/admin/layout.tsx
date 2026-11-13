
"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

import {
  LayoutDashboard,
  Package,
  Tags,
  ShoppingBag,
  Settings,
  Menu,
  X,
  LogOut,
  Store,
  UserRound,
  ChevronRight,
} from "lucide-react";

import { useAuth } from "@/context/AuthContext";

const navigation = [
  {
    name: "Dashboard",
    href: "/admin",
    icon: LayoutDashboard,
  },
  {
    name: "Products",
    href: "/admin/products",
    icon: Package,
  },
  {
    name: "Categories",
    href: "/admin/categories",
    icon: Tags,
  },
  {
    name: "Orders",
    href: "/admin/orders",
    icon: ShoppingBag,
  },
  {
    name: "Settings",
    href: "/admin/settings",
    icon: Settings,
  },
];

export default function AdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();

  const { user, isLoading, logout } = useAuth();

  const [sidebarOpen, setSidebarOpen] = useState(false);


  useEffect(() => {
    if (!isLoading && (!user || user.role !== "admin")) {
      router.replace(user ? "/" : "/login");
    }
  }, [isLoading, user, router]);



  const handleLogout = () => {
    logout();
    router.replace("/login");
  };

  if (isLoading || !user || user.role !== "admin") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-gray-200 border-t-green-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">

      {sidebarOpen && (
        <button
          type="button"
          aria-label="Close sidebar"
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-[260px] flex-col bg-[#111827] text-white transition-transform duration-300 lg:translate-x-0 ${sidebarOpen ? "translate-x-0" : "-translate-x-full"
          }`}
      >
        <div className="flex h-[76px] items-center justify-between border-b border-white/10 px-6">
          <Link href="/admin" className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-green-500 text-xl font-bold text-white">
              M
            </div>

            <div>
              <h1 className="text-xl font-bold tracking-wide">
                Malta<span className="text-green-400">.</span>
              </h1>
              <p className="text-[10px] uppercase tracking-[2px] text-gray-400">
                Admin Panel
              </p>
            </div>
          </Link>

          <button
            type="button"
            onClick={() => setSidebarOpen(false)}
            className="rounded-lg p-2 text-gray-400 hover:bg-white/10 lg:hidden"
            aria-label="Close menu"
          >
            <X size={21} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-7">
          <p className="mb-4 px-3 text-[11px] font-semibold uppercase tracking-[1.5px] text-gray-500">
            Main Menu
          </p>

          <nav className="space-y-2">
            {navigation.map((item) => {
              const Icon = item.icon;

              const isActive =
                item.href === "/admin"
                  ? pathname === "/admin"
                  : pathname.startsWith(item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setSidebarOpen(false)}
                  className={`group flex items-center justify-between rounded-xl px-3 py-3 text-sm font-medium transition ${isActive
                      ? "bg-green-600 text-white shadow-lg shadow-green-900/20"
                      : "text-gray-400 hover:bg-white/5 hover:text-white"
                    }`}
                >
                  <span className="flex items-center gap-3">
                    <Icon size={19} />
                    {item.name}
                  </span>

                  {isActive && <ChevronRight size={17} />}
                </Link>
              );
            })}
          </nav>

          
          <div className="mt-10">
            <p className="mb-4 px-3 text-[11px] font-semibold uppercase tracking-[1.5px] text-gray-500">
              Store
            </p>

            <Link
              href="/"
              className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-gray-400 transition hover:bg-white/5 hover:text-white"
            >
              <Store size={19} />
              Visit Store
            </Link>
          </div>
        </div>

        <div className="border-t border-white/10 p-4">
          <div className="flex items-center gap-3 rounded-xl bg-white/5 p-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-green-600 text-white">
              <UserRound size={20} />
            </div>

            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-white">
                {user.name}
              </p>
              <p className="truncate text-xs text-gray-400">
                Administrator
              </p>
            </div>

            <button
              type="button"
              onClick={handleLogout}
              aria-label="Logout"
              title="Logout"
              className="rounded-lg p-2 text-gray-400 transition hover:bg-red-500/10 hover:text-red-400"
            >
              <LogOut size={19} />
            </button>
          </div>
        </div>
      </aside>

      <div className="min-h-screen lg:pl-[260px]">

        <header className="sticky top-0 z-30 flex h-[76px] items-center justify-between border-b border-gray-200 bg-white px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open navigation"
              className="rounded-lg p-2 text-gray-600 transition hover:bg-gray-100 lg:hidden"
            >
              <Menu size={23} />
            </button>

            <div>
              <h2 className="text-lg font-bold text-gray-900">
                {navigation.find((item) =>
                  item.href === "/admin"
                    ? pathname === "/admin"
                    : pathname.startsWith(item.href)
                )?.name ?? "Admin"}
              </h2>

              <p className="hidden text-xs text-gray-400 sm:block">
                Malta Store Management
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-semibold text-gray-900">
                {user.name}
              </p>
              <p className="text-xs text-gray-500">
                {user.email}
              </p>
            </div>

            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100 text-green-700">
              <UserRound size={21} />
            </div>
          </div>
        </header>

        <main className="min-h-[calc(100vh-76px)]">
          {children}
        </main>
      </div>
    </div>
  );
}
