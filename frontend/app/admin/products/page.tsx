
"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import DeleteProductDialog from "@/components/admin/products/DeleteProductDialog";
import Link from "next/link";

import {
  Plus,
  Search,
  Pencil,
  Trash2,
  Package,
  Eye,
  EyeOff,
} from "lucide-react";

import { useAuth } from "@/context/AuthContext";

import {
  getProductsSnapshot,
  getServerProductsSnapshot,
  subscribeToProducts,
  saveProducts,
} from "@/lib/product-storage";

export default function AdminProductsPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  const products = useSyncExternalStore(
    subscribeToProducts,
    getProductsSnapshot,
    getServerProductsSnapshot
  );

  const [search, setSearch] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<{
    id: number;
    name: string;
  } | null>(null);


  useEffect(() => {
    if (!isLoading && (!user || user.role !== "admin")) {
      router.replace(user ? "/" : "/login");
    }
  }, [isLoading, user, router]);

  
  const filteredProducts = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) return products;

    return products.filter((product) =>
      [
        product.name,
        product.nameNp ?? "",
        product.category,
      ].some((value) => value.toLowerCase().includes(query))
    );
  }, [products, search]);

  // Delete product
  // const handleDelete = (productId: number) => {
  //   const product = products.find((item) => item.id === productId);

  //   if (!product) return;

  //   const confirmed = window.confirm(
  //     `Are you sure you want to delete "${product.name}"?`
  //   );

  //   if (!confirmed) return;

  //   const updatedProducts = products.filter(
  //     (item) => item.id !== productId
  //   );

  //   saveProducts(updatedProducts);
  // };

  function handleDeleteProduct() {
    if (!selectedProduct) return;

    const updatedProducts = products.filter(
      (product) => product.id !== selectedProduct.id
    );

    saveProducts(updatedProducts);
    setSelectedProduct(null);
  }

  
  const handleToggleVisibility = (productId: number) => {
    const updatedProducts = products.map((product) =>
      product.id === productId
        ? {
          ...product,
          isVisible: !product.isVisible,
        }
        : product
    );

    saveProducts(updatedProducts);
  };

 
  if (isLoading || !user || user.role !== "admin") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="h-9 w-9 animate-spin rounded-full border-4 border-gray-200 border-t-green-700" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl">

        <div className="mb-6 flex items-center gap-2 text-sm text-gray-500">
          <Link href="/admin" className="hover:text-green-700">
            Dashboard
          </Link>

          <span>/</span>

          <span className="font-medium text-gray-900">
            Products
          </span>
        </div>

        <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              Products
            </h1>

            <p className="mt-2 text-sm text-gray-500">
              Manage your store products, prices and inventory catalog.
            </p>
          </div>

          <Link
            href="/admin/products/add"
            className="flex items-center justify-center gap-2 rounded-xl bg-green-700 px-5 py-3 text-sm font-semibold text-white transition hover:bg-green-800"
          >
            <Plus size={19} />
            Add Product
          </Link>
        </div>

        <div className="mb-7 grid grid-cols-1 gap-4 sm:grid-cols-3">

          <div className="rounded-2xl border border-gray-200 bg-white p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">
                  Total Products
                </p>

                <h2 className="mt-2 text-3xl font-bold text-gray-900">
                  {products.length}
                </h2>
              </div>

              <div className="rounded-xl bg-green-50 p-3 text-green-700">
                <Package size={24} />
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-5">
            <p className="text-sm text-gray-500">
              Categories Used
            </p>

            <h2 className="mt-2 text-3xl font-bold text-gray-900">
              {new Set(products.map((product) => product.category)).size}
            </h2>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-5">
            <p className="text-sm text-gray-500">
              Products on Offer
            </p>

            <h2 className="mt-2 text-3xl font-bold text-gray-900">
              {
                products.filter(
                  (product) =>
                    product.originalPrice !== undefined &&
                    product.originalPrice > product.price
                ).length
              }
            </h2>
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white">

          <div className="border-b border-gray-100 p-4 sm:p-5">
            <div className="relative max-w-md">
              <Search
                size={19}
                className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"
              />

              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search products..."
                className="w-full rounded-xl border border-gray-200 bg-gray-50 py-3 pl-11 pr-4 text-sm outline-none focus:border-green-600"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[1050px] text-left">

              <thead className="bg-gray-50 text-xs uppercase tracking-wider text-gray-500">
                <tr>
                  <th className="px-5 py-4">Product</th>
                  <th className="px-5 py-4">Category</th>
                  <th className="px-5 py-4">Price</th>
                  <th className="px-5 py-4">Original Price</th>
                  <th className="px-5 py-4">Stock</th>
                  <th className="px-5 py-4">Visibility</th>
                  <th className="px-5 py-4">Actions</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-gray-100">

                {filteredProducts.map((product) => (
                  <tr
                    key={product.id}
                    className="transition hover:bg-gray-50"
                  >

                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">

                        <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-gray-100">
                          <img
                            src={product.image}
                            alt={product.name}
                            className="h-full w-full object-cover"
                          />
                        </div>

                        <div>
                          <p className="font-semibold text-gray-900">
                            {product.name}
                          </p>

                          {product.nameNp && (
                            <p className="mt-1 text-xs text-gray-500">
                              {product.nameNp}
                            </p>
                          )}
                        </div>

                      </div>
                    </td>

                    <td className="px-5 py-4">
                      <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700">
                        {product.category}
                      </span>
                    </td>

                    <td className="px-5 py-4 text-sm font-semibold text-gray-900">
                      Rs. {product.price}
                    </td>

                    <td className="px-5 py-4 text-sm text-gray-500">
                      {product.originalPrice
                        ? `Rs. ${product.originalPrice}`
                        : "—"}
                    </td>

                    <td className="px-5 py-4">
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${product.stock === 0
                          ? "bg-red-50 text-red-600"
                          : product.stock <= 5
                            ? "bg-yellow-50 text-yellow-700"
                            : "bg-green-50 text-green-700"
                          }`}
                      >
                        {product.stock} units
                      </span>
                    </td>

                    <td className="px-5 py-4">
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${product.isVisible
                          ? "bg-green-50 text-green-700"
                          : "bg-gray-100 text-gray-600"
                          }`}
                      >
                        {product.isVisible ? "Visible" : "Hidden"}
                      </span>
                    </td>

                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">

                        <Link
                          href={`/admin/products/${product.id}/edit`}
                          aria-label={`Edit ${product.name}`}
                          title="Edit product"
                          className="rounded-lg p-2 text-blue-600 transition hover:bg-blue-50"
                        >
                          <Pencil size={18} />
                        </Link>

                        <button
                          type="button"
                          onClick={() =>
                            handleToggleVisibility(product.id)
                          }
                          aria-label={
                            product.isVisible
                              ? `Hide ${product.name}`
                              : `Show ${product.name}`
                          }
                          title={
                            product.isVisible
                              ? "Hide product"
                              : "Show product"
                          }
                          className="rounded-lg p-2 text-gray-600 transition hover:bg-gray-100"
                        >
                          {product.isVisible ? (
                            <Eye size={18} />
                          ) : (
                            <EyeOff size={18} />
                          )}
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            setSelectedProduct({
                              id: product.id,
                              name: product.name,
                            })
                          }
                          aria-label={`Delete ${product.name}`}
                          title="Delete product"
                          className="rounded-lg p-2 text-red-600 transition hover:bg-red-50"
                        >
                          <Trash2 size={18} />
                        </button>

                      </div>
                    </td>

                  </tr>
                ))}

                {filteredProducts.length === 0 && (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-5 py-12 text-center text-sm text-gray-500"
                    >
                      {search
                        ? "No products found matching your search."
                        : "No products available. Add your first product."}
                    </td>
                  </tr>
                )}

              </tbody>
            </table>
          </div>

          <div className="border-t border-gray-100 px-5 py-4 text-sm text-gray-500">
            Showing {filteredProducts.length} of {products.length} products
          </div>

        </div>
      </div>
      <DeleteProductDialog
        isOpen={selectedProduct !== null}
        productName={selectedProduct?.name ?? ""}
        onCancel={() => setSelectedProduct(null)}
        onConfirm={handleDeleteProduct}
      />
    </div>
  );
}
