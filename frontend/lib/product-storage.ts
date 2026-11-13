import {
  products as initialProducts,
  type Product,
} from "@/data/products";

export type AdminProduct = Product & {
  nameNp?: string;
  stock: number;
  isVisible: boolean;
};

const PRODUCT_KEY = "malta-products";
const PRODUCT_EVENT = "malta-products-updated";

const defaultProducts: AdminProduct[] = initialProducts.map(
  (product) => ({
    ...product,
    stock: 0,
    isVisible: true,
  })
);

let cachedRaw: string | null | undefined;
let cachedProducts: AdminProduct[] = defaultProducts;

const listeners = new Set<() => void>();

function notifyListeners() {
  listeners.forEach((listener) => listener());
}


function normalizeProducts(data: unknown): AdminProduct[] {
  if (!Array.isArray(data)) {
    return defaultProducts;
  }

  return data.map((product) => ({
    ...product,
    stock:
      typeof product.stock === "number"
        ? product.stock
        : 0,
    isVisible:
      typeof product.isVisible === "boolean"
        ? product.isVisible
        : true,
  }));
}

export function getProductsSnapshot(): AdminProduct[] {
  if (typeof window === "undefined") {
    return defaultProducts;
  }

  const raw = localStorage.getItem(PRODUCT_KEY);

  if (raw === cachedRaw) {
    return cachedProducts;
  }

  cachedRaw = raw;

  if (!raw) {
    cachedProducts = defaultProducts;
    return cachedProducts;
  }

  try {
    cachedProducts = normalizeProducts(JSON.parse(raw));
  } catch {
    cachedProducts = defaultProducts;
  }

  return cachedProducts;
}

export function getServerProductsSnapshot(): AdminProduct[] {
  return defaultProducts;
}

export function subscribeToProducts(callback: () => void) {
  listeners.add(callback);

  const handleStorage = (event: StorageEvent) => {
    if (event.key === PRODUCT_KEY) {
      cachedRaw = undefined;
      callback();
    }
  };

  const handleProductUpdate = () => {
    callback();
  };

  window.addEventListener("storage", handleStorage);
  window.addEventListener(PRODUCT_EVENT, handleProductUpdate);

  callback();

  return () => {
    listeners.delete(callback);

    window.removeEventListener("storage", handleStorage);
    window.removeEventListener(PRODUCT_EVENT, handleProductUpdate);
  };
}

export function saveProducts(updatedProducts: AdminProduct[]) {
  const raw = JSON.stringify(updatedProducts);

  localStorage.setItem(PRODUCT_KEY, raw);

  cachedRaw = raw;
  cachedProducts = updatedProducts;

  window.dispatchEvent(new Event(PRODUCT_EVENT));
  notifyListeners();
}