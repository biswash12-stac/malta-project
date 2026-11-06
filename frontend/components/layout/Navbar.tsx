
"use client";

import { Suspense } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Search,
  Heart,
  ShoppingCart,
  UserRound,
} from "lucide-react";

const navLinks = [
  { name: "Home", href: "/" },
  { name: "Shop", href: "/products" },
  { name: "Categories", href: "/categories" },
  { name: "Offers", href: "/offers" },
];

// Component that uses usePathname()
function NavbarContent() {
  const pathname = usePathname();

  return (
    <header className="w-full bg-black text-white border-b border-[#222]">
      <nav className="relative flex h-[86px] items-center justify-between px-6 md:px-10">

        <Link href="/" className="text-2xl font-bold tracking-tight">
          Bazaar
        </Link>

        <div className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-6 md:flex">
          {navLinks.map((link) => {
            const isActive =
              pathname === link.href ||
              (link.href !== "/" && pathname.startsWith(link.href));

            return (
              <Link
                key={link.name}
                href={link.href}
                className={`text-xl font-medium transition-colors duration-200 ${
                  isActive
                    ? "text-[#35C477]"
                    : "text-white hover:text-[#35C477]"
                }`}
              >
                {link.name}
              </Link>
            );
          })}
        </div>

        <div className="flex items-center gap-5">
          <button aria-label="Search" className="transition-colors hover:text-[#35C477]">
            <Search size={27} strokeWidth={2} />
          </button>

          <Link
            href="/wishlist"
            aria-label="Wishlist"
            className="transition-colors hover:text-[#35C477]"
          >
            <Heart size={27} strokeWidth={2} />
          </Link>

          <Link
            href="/cart"
            aria-label="Shopping cart"
            className="transition-colors hover:text-[#35C477]"
          >
            <ShoppingCart size={29} strokeWidth={2} />
          </Link>

          <button aria-label="Account" className="transition-colors hover:text-[#35C477]">
            <UserRound size={27} strokeWidth={2} />
          </button>
        </div>

      </nav>
    </header>
  );
}

// Parent component provides Suspense boundary
export default function Navbar() {
  return (
    <Suspense
      fallback={
        <header className="h-[86px] w-full bg-black border-b border-[#222]" />
      }
    >
      <NavbarContent />
    </Suspense>
  );
}
