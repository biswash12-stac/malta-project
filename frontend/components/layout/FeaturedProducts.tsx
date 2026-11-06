
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import ProductCard from "@/components/product/ProductCard";
import type { Product } from "@/types/product";

const products: Product[] = [
  {
    _id: "1",
    name: "Fresh Green Apples",
    image: "/images/products/apple.jpg",
    price: 3.99,
    originalPrice: 5.49,
    rating: 4.8,
    reviews: 120,
    category: "Fresh Fruits",
    nameNp: "ताजा हरियो स्याउ"
  },
  {
    _id: "2",
    name: "Fresh Broccoli",
    image: "/images/products/broccoli.jpg",
    price: 2.49,
    rating: 4.7,
    reviews: 85,
    category: "Vegetables",
    originalPrice: 3.49,
    nameNp: "ताजा ब्रोकोली"
  },
  {
    _id: "3",
    name: "Fresh Strawberries",
    image: "/images/products/strawberries.jpg",
    price: 4.20,
    originalPrice: 5.00,
    rating: 4.9,
    reviews: 150,
    category: "Fresh Fruits",
    nameNp: "ताजा स्ट्रबेरी"
  },
  {
    _id: "4",
    name: "Green Bell Peppers",
    image: "/images/products/bellpepper.jpg",
    price: 2.99,
    rating: 4.6,
    reviews: 65,
    category: "Vegetables",
    originalPrice: 3.99,
    nameNp: "हरियो भेडे खुर्सानी"
  },
];

export default function FeaturedProducts() {
  return (
    <section className="mx-auto max-w-7xl px-5 py-12 md:px-8 md:py-16">

      {/* Section Heading */}
      <div className="mb-8 flex items-center justify-between">

        <div>
          <p className="mb-2 text-sm font-semibold uppercase tracking-widest text-green-700">
            Our selection
          </p>

          <h2 className="text-2xl font-bold text-gray-900 md:text-3xl">
            Featured Products
          </h2>

          <p className="mt-2 text-sm text-gray-500">
            Fresh picks selected just for you.
          </p>
        </div>

        <Link
          href="/products"
          className="flex items-center gap-2 text-sm font-semibold text-green-700 transition hover:gap-3"
        >
          View All <ArrowRight size={17} />
        </Link>

      </div>

      {/* Product Grid */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 md:gap-6 lg:grid-cols-4">
        {products.map((product) => (
          <ProductCard key={product._id} product={product} />
        ))}
      </div>

    </section>
  );
}
