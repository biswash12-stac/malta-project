
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  //   Facebook,
  //   Instagram,
  //   Twitter,
  //   Youtube,
  Mail,
  Phone,
  MapPin,
} from "lucide-react";

const footerGroups = [
  {
    title: "My Account",
    links: [
      { name: "My Account", href: "/account" },
      { name: "Order History", href: "/orders" },
      { name: "Shopping Cart", href: "/cart" },
      { name: "Wishlist", href: "/wishlist" },
      { name: "Settings", href: "/account/settings" },
    ],
  },
  {
    title: "Help & Support",
    links: [
      { name: "Contact Us", href: "/contact" },
      { name: "FAQs", href: "/faq" },
      { name: "Terms & Conditions", href: "/terms" },
      { name: "Privacy Policy", href: "/privacy" },
      { name: "Return Policy", href: "/returns" },
    ],
  },
  {
    title: "Our Company",
    links: [
      { name: "About Us", href: "/about" },
      { name: "Shop", href: "/products" },
      { name: "Categories", href: "/categories" },
      { name: "Products", href: "/products" },
      { name: "Track Order", href: "/orders/track" },
    ],
  },
];

export default function Footer() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [year, setYear] = useState<number | null>(2026);

  useEffect(() => {
    setYear(new Date().getFullYear());
  }, []);

  const handleSubscribe = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!email.trim()) return;

    // TODO: Connect this to the newsletter subscription API.
    setMessage("Newsletter API connection is coming soon.");
  };

  return (
    <footer className="w-full">


      <section className="bg-[#F4F5F2] py-8 md:py-10">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-6 px-5 md:flex-row md:px-8">


          <Link
            href="/"
            className="text-2xl font-extrabold tracking-tight text-gray-900"
          >
            Malta<span className="text-green-600">.</span>
          </Link>


          <div className="text-center md:text-left">
            <h2 className="text-lg font-bold text-gray-900">
              Subscribe to our Newsletter
            </h2>

            <p className="mt-1 text-xs text-gray-500">
              Be the first to know about our latest offers and updates.
            </p>
          </div>


          <div className="w-full max-w-md">
            <form
              onSubmit={handleSubscribe}
              className="flex items-center rounded-full border border-gray-200 bg-white p-1"
            >
              <input
                type="email"
                required
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setMessage("");
                }}
                placeholder="Enter your email address"
                className="min-w-0 flex-1 bg-transparent px-4 py-2 text-xs text-gray-800 outline-none placeholder:text-gray-400"
              />

              <button
                type="submit"
                className="shrink-0 rounded-full bg-green-600 px-5 py-2.5 text-xs font-semibold text-white transition hover:bg-green-700"
              >
                Subscribe
              </button>
            </form>

            {message && (
              <p aria-live="polite" className="mt-2 text-xs text-green-700">
                {message}
              </p>
            )}
          </div>

        </div>
      </section>

      <section className="bg-[#171A17] py-12 text-gray-300">
        <div className="mx-auto max-w-7xl px-5 md:px-8">

          <div className="grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-4">


            <div>
              <Link
                href="/"
                className="text-2xl font-extrabold tracking-tight text-white"
              >
                Malta<span className="text-green-500">.</span>
              </Link>

              <p className="mt-4 max-w-xs text-sm leading-6 text-gray-400">
                Your trusted destination for fresh products,
                quality groceries and everyday essentials.
                Shop smarter and enjoy a better experience with Malta.
              </p>

              <div className="mt-5 space-y-3 text-xs text-gray-400">

                <div className="flex items-center gap-3">
                  <Phone size={15} className="text-green-500" />
                  <span>+977 9700000000</span>
                </div>

                <div className="flex items-center gap-3">
                  <Mail size={15} className="text-green-500" />
                  <span>support@malta.com</span>
                </div>

                <div className="flex items-center gap-3">
                  <MapPin size={15} className="text-green-500" />
                  <span>Kathmandu, Nepal</span>
                </div>

              </div>
            </div>


            {footerGroups.map((group) => (
              <div key={group.title}>
                <h3 className="mb-5 text-sm font-bold text-white">
                  {group.title}
                </h3>

                <ul className="space-y-3">
                  {group.links.map((link) => (
                    <li key={link.name}>
                      <Link
                        href={link.href}
                        className="text-xs text-gray-400 transition-colors hover:text-green-400"
                      >
                        {link.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}

          </div>


          <div className="mt-12 border-t border-white/10 pt-7">

            <div className="flex flex-col items-center justify-between gap-5 md:flex-row">


              <div className="flex items-center gap-4">
                <a href="#" aria-label="Facebook" className="flex h-8 w-8 items-center justify-center rounded-full bg-green-600 text-white transition hover:bg-green-500">
                  {/* <Facebook size={15} /> */}
                  f
                </a>

                <a href="#" aria-label="Twitter" className="text-gray-400 transition hover:text-green-400">
                  {/* <Twitter size={16} /> */}
                  X
                </a>

                <a href="#" aria-label="Instagram" className="text-gray-400 transition hover:text-green-400">
                  {/* <Instagram size={16} /> */}
                  I
                </a>

                <a href="#" aria-label="YouTube" className="text-gray-400 transition hover:text-green-400">
                  {/* <Youtube size={17} /> */}
                  Y
                </a>
              </div>

              <p className="text-center text-xs text-gray-500">
                © {year ?? 2026} Malta. All rights reserved.
              </p>

              {/* Payment Methods
              <div className="flex items-center gap-2">
                <span className="rounded bg-white px-2 py-1 text-[10px] font-bold text-gray-800">
                  VISA
                </span>

                <span className="rounded bg-white px-2 py-1 text-[10px] font-bold text-blue-700">
                  PayPal
                </span>

                <span className="rounded bg-white px-2 py-1 text-[10px] font-bold text-gray-800">
                  COD
                </span>
              </div> */}

            </div>
          </div>

        </div>
      </section>

    </footer>
  );
}
