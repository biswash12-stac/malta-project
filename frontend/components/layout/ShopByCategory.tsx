
import Link from "next/link";
import {
  ArrowRight,
  Carrot,
  Apple,
  Fish,
  Beef,
  Milk,
  Coffee,
  Cookie,
} from "lucide-react";

const categories = [
  { name: "Vegetables", icon: Carrot, count: "120+ Products" },
  { name: "Fruits", icon: Apple, count: "85+ Products" },
  { name: "Seafood", icon: Fish, count: "45+ Products" },
  { name: "Meat", icon: Beef, count: "60+ Products" },
  { name: "Dairy", icon: Milk, count: "50+ Products" },
  { name: "Beverages", icon: Coffee, count: "90+ Products" },
  { name: "Snacks", icon: Cookie, count: "75+ Products" },
];

export default function ShopByCategory() {
  return (
    <section className="bg-[#F3F6EF] py-14 md:py-16">

      <div className="mx-auto max-w-7xl px-5 md:px-8">

        {/* Section Heading */}
        <div className="mb-9 flex items-center justify-between">

          <div>
            <p className="mb-2 text-sm font-semibold uppercase tracking-widest text-green-700">
              Explore our collection
            </p>

            <h2 className="text-2xl font-bold text-gray-900 md:text-3xl">
              Shop by Category
            </h2>

            <p className="mt-2 text-sm text-gray-500">
              Find everything you need in one place.
            </p>
          </div>

          <Link
            href="/categories"
            className="flex items-center gap-2 text-sm font-semibold text-green-700 transition hover:gap-3"
          >
            All Categories <ArrowRight size={17} />
          </Link>

        </div>

        {/* Category Grid */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7">

          {categories.map((category) => {
            const Icon = category.icon;

            return (
              <Link
                key={category.name}
                href={`/categories?name=${encodeURIComponent(category.name)}`}
                className="group flex flex-col items-center justify-center rounded-2xl border border-white bg-white px-3 py-6 text-center transition-all duration-300 hover:-translate-y-1 hover:border-green-300 hover:shadow-md"
              >
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#EAF3E5] text-green-700 transition-colors group-hover:bg-green-700 group-hover:text-white">
                  <Icon size={30} strokeWidth={1.7} />
                </div>

                <h3 className="text-sm font-semibold text-gray-800">
                  {category.name}
                </h3>

                <p className="mt-1 text-xs text-gray-400">
                  {category.count}
                </p>
              </Link>
            );
          })}

        </div>

      </div>
    </section>
  );
}
