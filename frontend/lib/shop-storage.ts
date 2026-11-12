export type CartItem = {
  id: number;
  name: string;
  price: number;
  image: string;
  quantity: number;
};

const CART_KEY = "malta-cart";
const WISHLIST_KEY = "malta-wishlist";

const CART_EVENT = "malta-cart-updated";
const WISHLIST_EVENT = "malta-wishlist-updated";


let cachedWishlistRaw: string | null = null;
let cachedWishlist: number[] = [];

const EMPTY_WISHLIST: number[] = [];

function readStorage<T>(key: string, fallback: T): T {
  try {
    const value = localStorage.getItem(key);
    return value ? (JSON.parse(value) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeStorage<T>(key: string, value: T): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}


export function getCart(): CartItem[] {
  const value = readStorage<unknown>(CART_KEY, []);

  if (!Array.isArray(value)) return [];

  return value.filter(
    (item): item is CartItem =>
      item !== null &&
      typeof item === "object" &&
      typeof item.id === "number" &&
      typeof item.name === "string" &&
      typeof item.price === "number" &&
      typeof item.image === "string" &&
      typeof item.quantity === "number" &&
      item.quantity > 0,
  );
}

export function saveCart(cart: CartItem[]): boolean {
  const saved = writeStorage(CART_KEY, cart);

  if (saved && typeof window !== "undefined") {
    window.dispatchEvent(new Event(CART_EVENT));
  }

  return saved;
}

export function getCartCount(): number {
  return getCart().reduce((total, item) => total + item.quantity, 0);
}


export function getWishlist(): number[] {
  const value = readStorage<unknown>(WISHLIST_KEY, []);

  if (!Array.isArray(value)) return [];

  return value.filter((id): id is number => typeof id === "number");
}

export function getWishlistSnapshot(): number[] {
  let raw: string;

  try {
    raw = localStorage.getItem(WISHLIST_KEY) || "[]";
  } catch {
    return EMPTY_WISHLIST;
  }

  if (raw === cachedWishlistRaw) {
    return cachedWishlist;
  }

  cachedWishlistRaw = raw;

  try {
    const parsed: unknown = JSON.parse(raw);

    cachedWishlist = Array.isArray(parsed)
      ? parsed.filter((id): id is number => typeof id === "number")
      : [];
  } catch {
    cachedWishlist = [];
  }

  return cachedWishlist;
}

export function saveWishlist(wishlist: number[]): boolean {
  const saved = writeStorage(WISHLIST_KEY, wishlist);

  if (saved && typeof window !== "undefined") {
    window.dispatchEvent(new Event(WISHLIST_EVENT));
  }

  return saved;
}

export function subscribeToShopStorage(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener(CART_EVENT, callback);
  window.addEventListener(WISHLIST_EVENT, callback);

  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(CART_EVENT, callback);
    window.removeEventListener(WISHLIST_EVENT, callback);
  };
}



const EMPTY_CART: CartItem[] = [];

let cachedCartRaw: string | null = null;
let cachedCart: CartItem[] = [];

export function getCartSnapshot(): CartItem[] {
  let raw: string;

  try {
    raw = localStorage.getItem(CART_KEY) || "[]";
  } catch {
    return EMPTY_CART;
  }

  if (raw === cachedCartRaw) {
    return cachedCart;
  }

  cachedCartRaw = raw;

  try {
    const parsed: unknown = JSON.parse(raw);

    if (!Array.isArray(parsed)) {
      cachedCart = [];
    } else {
      cachedCart = parsed.filter(
        (item): item is CartItem =>
          item !== null &&
          typeof item === "object" &&
          typeof item.id === "number" &&
          typeof item.name === "string" &&
          typeof item.price === "number" &&
          typeof item.image === "string" &&
          typeof item.quantity === "number" &&
          item.quantity > 0,
      );
    }
  } catch {
    cachedCart = [];
  }

  return cachedCart;
}

export function getEmptyCartSnapshot(): CartItem[] {
  return EMPTY_CART;
}

export function getEmptyWishlistSnapshot() {
  return EMPTY_WISHLIST;
}

