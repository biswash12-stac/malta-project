
import Image from "next/image";
import Link from "next/link";
import { Heart, Star } from "lucide-react";
import type { Product } from "@/types/product";

interface ProductCardProps {
  product: Product;
}

export default function ProductCard({ product }: ProductCardProps) {
  return (
    <div className="group overflow-hidden rounded-2xl border border-gray-100 bg-white transition-all duration-300 hover:-translate-y-1 hover:shadow-lg">

      <div className="relative m-2 flex h-44 items-center justify-center overflow-hidden rounded-xl bg-[#F3F6EF] md:h-52">

        {product.originalPrice && (
          <span className="absolute left-3 top-3 z-10 rounded-full bg-green-700 px-3 py-1 text-xs font-semibold text-white">
            Sale
          </span>
        )}

        <div className="absolute right-3 top-3 z-10 rounded-full bg-white p-2 text-gray-700">
          <Heart size={17} />
        </div>

        <Link
          href={`/products/${product._id}`}
          className="relative h-full w-full"
        >
          <Image
            src={product.image}
            alt={product.name}
            fill
            sizes="(max-width: 768px) 50vw, 25vw"
            className="object-contain p-4 transition-transform duration-500 group-hover:scale-110"
          />
        </Link>
      </div>

      <div className="space-y-2 p-4">

        <p className="text-xs font-medium uppercase tracking-wide text-green-700">
          {product.category}
        </p>

        <Link href={`/products/${product._id}`}>
          <div className="space-y-1">
            <h3 className="line-clamp-1 font-semibold text-gray-900 transition-colors hover:text-green-700">
            {product.name} ({product.nameNp})
          </h3>
            <p className="line-clamp-1 text-sm text-gray-500">
              {product.nameNp}
            </p>
          </div>
        </Link>

        <div className="flex items-center gap-1">
          <Star size={14} fill="#F5A623" color="#F5A623" />
          <span className="text-xs font-medium text-gray-700">
            {product.rating}
          </span>
          <span className="text-xs text-gray-400">
            ({product.reviews} reviews)
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-lg font-bold text-gray-900">
            ${product.price.toFixed(2)}
          </span>

          {product.originalPrice && (
            <span className="text-sm text-gray-400 line-through">
              ${product.originalPrice.toFixed(2)}
            </span>
          )}
        </div>

      </div>
    </div>
  );
}
