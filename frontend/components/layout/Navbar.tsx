
"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Search,
  Heart,
  ShoppingCart,
  UserRound,
  X,
  ArrowRight,
} from "lucide-react";

import { useSyncExternalStore } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";

import {
  getCartCount,
  subscribeToShopStorage,
} from "@/lib/shop-storage";

import { products } from "@/data/products";

gsap.registerPlugin(useGSAP);

const navLinks = [
  { name: "Home", href: "/" },
  { name: "Shop", href: "/products" },
  { name: "Categories", href: "/categories" },
  { name: "Offers", href: "/offers" },
  { name: "My Orders", href: "/orders" },
];

function NavbarContent() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, isLoading } = useAuth();

  const cartCount = useSyncExternalStore(
    subscribeToShopStorage,
    getCartCount,
    () => 0
  );

  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  
  const navbarRef = useRef<HTMLElement>(null);
  const logoRef = useRef<HTMLAnchorElement>(null);
  const navLinkRefs = useRef<(HTMLAnchorElement | null)[]>([]);
  const iconRefs = useRef<(HTMLDivElement | null)[]>([]);
  const searchDropdownRef = useRef<HTMLDivElement>(null);

  
  const searchRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  
  useGSAP(
    () => {
      const navbar = navbarRef.current;
      const logo = logoRef.current;

      if (!navbar || !logo) return;

      const links = navLinkRefs.current.filter(
        (element): element is HTMLAnchorElement => element !== null
      );

      const icons = iconRefs.current.filter(
        (element): element is HTMLDivElement => element !== null
      );

      const timeline = gsap.timeline({
        defaults: {
          ease: "power3.out",
        },
      });

     
      timeline.from(navbar, {
        y: -35,
        opacity: 0,
        duration: 0.8,
      });

     
      timeline.from(
        logo,
        {
          y: 20,
          opacity: 0,
          scale: 0.9,
          duration: 0.65,
        },
        "-=0.4"
      );

      
      timeline.from(
        links,
        {
          y: 18,
          opacity: 0,
          duration: 0.55,
          stagger: 0.1,
        },
        "-=0.35"
      );

      
      timeline.from(
        icons,
        {
          y: 15,
          opacity: 0,
          scale: 0.85,
          duration: 0.45,
          stagger: 0.08,
        },
        "-=0.35"
      );

      
      const logoAccent = logo.querySelector(".logo-accent");

      if (logoAccent) {
        timeline.from(
          logoAccent,
          {
            scale: 0,
            transformOrigin: "left center",
            duration: 0.4,
          },
          "-=0.3"
        );
      }

      return () => {
        timeline.kill();
      };
    },
    { scope: navbarRef }
  );

 
  useGSAP(
    () => {
      const dropdown = searchDropdownRef.current;

      if (!searchOpen || !dropdown) return;

      gsap.fromTo(
        dropdown,
        {
          opacity: 0,
          y: -12,
          scale: 0.96,
          transformOrigin: "top right",
        },
        {
          opacity: 1,
          y: 0,
          scale: 1,
          duration: 0.35,
          ease: "power3.out",
        }
      );
    },
    {
      dependencies: [searchOpen],
      revertOnUpdate: true,
      scope: navbarRef,
    }
  );

  
  const filteredProducts = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    if (!query) return [];

    return products
      .filter((product) => {
        return (
          product.name.toLowerCase().includes(query) ||
          (product.nameNp ?? "").toLowerCase().includes(query) ||
          product.category.toLowerCase().includes(query) ||
          product.description.toLowerCase().includes(query)
        );
      })
      .slice(0, 6);
  }, [searchQuery]);

 
  useEffect(() => {
    if (!searchOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (
        searchRef.current &&
        !searchRef.current.contains(event.target as Node)
      ) {
        setSearchOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setSearchOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [searchOpen]);

 
  useEffect(() => {
    if (searchOpen) {
      inputRef.current?.focus();
    }
  }, [searchOpen]);

  const handleSearchSubmit = (
    event: React.FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();

    if (filteredProducts.length > 0) {
      router.push(`/products/${filteredProducts[0].id}`);
      closeSearch();
    } else if (searchQuery.trim()) {
      router.push(
        `/products?search=${encodeURIComponent(searchQuery.trim())}`
      );
      closeSearch();
    }
  };

  const closeSearch = () => {
    setSearchOpen(false);
    setSearchQuery("");
  };

  return (
    <header
      ref={navbarRef}
      className="relative z-50 w-full border-b border-[#222] bg-black text-white"
    >
      <nav className="relative flex h-[86px] items-center justify-between px-6 md:px-10">

        
        <Link
          ref={logoRef}
          href="/"
          className="text-2xl font-bold tracking-tight"
        >
          Bazaar<span className="logo-accent text-[#35C477]">.</span>
        </Link>

      
        <div className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-6 md:flex">
          {navLinks.map((link, index) => {
            const isActive =
              pathname === link.href ||
              (link.href !== "/" && pathname.startsWith(link.href));

            return (
              <Link
                key={link.name}
                ref={(element) => {
                  navLinkRefs.current[index] = element;
                }}
                href={link.href}
                className={`navbar-link relative text-xl font-medium transition-colors duration-300 ${
                  isActive
                    ? "text-[#35C477]"
                    : "text-white hover:text-[#35C477]"
                }`}
              >
                {link.name}
                <span
                  className={`navbar-underline absolute -bottom-2 left-0 h-[2px] w-full origin-left bg-[#35C477] ${
                    isActive ? "scale-x-100" : "scale-x-0"
                  }`}
                />
              </Link>
            );
          })}
        </div>

      
        <div className="flex items-center gap-5">

          
          <div
            ref={searchRef}
            className="relative"
          >
            <div
              ref={(element) => {
                iconRefs.current[0] = element;
              }}
            >
              <button
                type="button"
                aria-label="Search products"
                aria-expanded={searchOpen}
                onClick={() => setSearchOpen((previous) => !previous)}
                className={`transition-colors hover:text-[#35C477] ${
                  searchOpen ? "text-[#35C477]" : "text-white"
                }`}
              >
                {searchOpen ? (
                  <X size={25} />
                ) : (
                  <Search size={25} />
                )}
              </button>
            </div>

            
            {searchOpen && (
              <div
                ref={searchDropdownRef}
                className="absolute right-0 top-[calc(100%+24px)] z-[100] w-[min(90vw,420px)] overflow-hidden rounded-xl border border-gray-200 bg-white text-black shadow-2xl"
              >
                <form
                  onSubmit={handleSearchSubmit}
                  className="flex items-center gap-3 border-b border-gray-200 px-4 py-4"
                >
                  <Search
                    size={21}
                    className="shrink-0 text-gray-500"
                  />

                  <input
                    ref={inputRef}
                    type="search"
                    value={searchQuery}
                    onChange={(event) =>
                      setSearchQuery(event.target.value)
                    }
                    placeholder="Search products in English or Nepali..."
                    className="w-full bg-transparent text-sm text-gray-900 outline-none placeholder:text-gray-400"
                  />

                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery("")}
                      aria-label="Clear search"
                      className="text-gray-400 hover:text-black"
                    >
                      <X size={18} />
                    </button>
                  )}
                </form>

              
                <div className="max-h-[420px] overflow-y-auto p-3">

                  {!searchQuery.trim() && (
                    <div className="py-8 text-center">
                      <Search
                        size={30}
                        className="mx-auto mb-3 text-gray-300"
                      />

                      <p className="text-sm font-medium text-gray-700">
                        Search for your favorite products
                      </p>

                      <p className="mt-1 text-xs text-gray-400">
                        Try Apple, Milk, स्याउ or दूध
                      </p>
                    </div>
                  )}

                  {searchQuery.trim() &&
                    filteredProducts.length > 0 && (
                      <>
                        <p className="mb-2 px-2 text-xs font-semibold uppercase tracking-wider text-gray-400">
                          Products ({filteredProducts.length})
                        </p>

                        <div className="space-y-1">
                          {filteredProducts.map((product) => (
                            <Link
                              key={product.id}
                              href={`/products/${product.id}`}
                              onClick={closeSearch}
                              className="flex items-center gap-3 rounded-lg p-2 transition hover:bg-gray-100"
                            >
                              <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-gray-100">
                                {product.image ? (
                                  <img
                                    src={product.image}
                                    alt={product.name}
                                    className="h-full w-full object-cover"
                                  />
                                ) : (
                                  <div className="flex h-full items-center justify-center text-xs text-gray-400">
                                    No image
                                  </div>
                                )}
                              </div>

                              <div className="min-w-0 flex-1">
                                <h4 className="truncate text-sm font-semibold text-gray-900">
                                  {product.name}
                                </h4>

                                {product.nameNp && (
                                  <p className="mt-0.5 text-xs text-gray-500">
                                    {product.nameNp}
                                  </p>
                                )}

                                <p className="mt-1 text-sm font-bold text-[#279d5e]">
                                  Rs. {product.price}
                                </p>
                              </div>

                              <ArrowRight
                                size={17}
                                className="shrink-0 text-gray-400"
                              />
                            </Link>
                          ))}
                        </div>
                      </>
                    )}

                  {searchQuery.trim() &&
                    filteredProducts.length === 0 && (
                      <div className="py-8 text-center">
                        <Search
                          size={30}
                          className="mx-auto mb-3 text-gray-300"
                        />

                        <p className="text-sm font-semibold text-gray-800">
                          No products found
                        </p>

                        <p className="mt-1 text-xs text-gray-500">
                          Try another product name or keyword.
                        </p>
                      </div>
                    )}
                </div>

               
                {searchQuery.trim() && (
                  <Link
                    href={`/products?search=${encodeURIComponent(
                      searchQuery.trim()
                    )}`}
                    onClick={closeSearch}
                    className="flex items-center justify-center gap-2 border-t border-gray-200 px-4 py-3 text-sm font-semibold text-[#279d5e] transition hover:bg-gray-50"
                  >
                    View all products
                    <ArrowRight size={16} />
                  </Link>
                )}
              </div>
            )}
          </div>

         
          <div
            ref={(element) => {
              iconRefs.current[1] = element;
            }}
          >
            <Link
              href="/wishlist"
              aria-label="Wishlist"
              className="navbar-icon inline-flex transition-colors hover:text-[#35C477]"
            >
              <Heart size={25} />
            </Link>
          </div>

         
          <div
            ref={(element) => {
              iconRefs.current[2] = element;
            }}
          >
            <Link
              href="/cart"
              aria-label={`Shopping cart with ${cartCount} items`}
              className="navbar-icon relative inline-flex items-center justify-center transition-colors hover:text-[#35C477]"
            >
              <ShoppingCart size={23} />

              {cartCount > 0 && (
                <span className="absolute -right-2 -top-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#35C477] px-1 text-[10px] font-bold text-white ring-2 ring-black">
                  {cartCount > 99 ? "99+" : cartCount}
                </span>
              )}
            </Link>
          </div>

          
          <div
            ref={(element) => {
              iconRefs.current[3] = element;
            }}
          >
            {isLoading ? (
              <div className="h-10 w-20 animate-pulse rounded-lg bg-gray-800" />
            ) : user ? (
              <Link
                href="/account"
                aria-label="My Account"
                className="navbar-icon flex items-center gap-2 rounded-lg border border-[#35C477] px-3 py-2 text-sm font-semibold text-white transition hover:bg-[#35C477] hover:text-black"
              >
                <UserRound size={20} />
                <span>My Account</span>
              </Link>
            ) : (
              <Link
                href="/login"
                aria-label="Login"
                className="navbar-icon flex items-center gap-2 rounded-lg bg-[#35C477] px-4 py-2 text-sm font-semibold text-black transition hover:bg-[#279d5e] hover:text-white"
              >
                <UserRound size={19} />
                <span>Login</span>
              </Link>
            )}
          </div>
        </div>
      </nav>
    </header>
  );
}

export default function Navbar() {
  return (
    <Suspense
      fallback={
        <header className="h-[86px] w-full border-b border-[#222] bg-black" />
      }
    >
      <NavbarContent />
    </Suspense>
  );
}
