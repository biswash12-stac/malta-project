
import { categories as initialCategories } from "@/data/products";

export type AdminCategory = {
  id: string;
  name: string;
  nameNp: string;
  isVisible: boolean;
};

const CATEGORY_KEY = "malta-categories";
const CATEGORY_EVENT = "malta-categories-updated";

const defaultCategories: AdminCategory[] = initialCategories.map(
  (name) => ({
    id: name.toLowerCase().replace(/\s+/g, "-"),
    name,
    nameNp: "",
    isVisible: true,
  })
);

let cachedRaw: string | null | undefined;
let cachedCategories: AdminCategory[] = defaultCategories;

const listeners = new Set<() => void>();

function notifyListeners() {
  listeners.forEach((listener) => listener());
}

export function getCategoriesSnapshot(): AdminCategory[] {
  if (typeof window === "undefined") {
    return defaultCategories;
  }

  const raw = localStorage.getItem(CATEGORY_KEY);

  if (raw === cachedRaw) {
    return cachedCategories;
  }

  cachedRaw = raw;

  if (!raw) {
    cachedCategories = defaultCategories;
    return cachedCategories;
  }

  try {
    const parsed: unknown = JSON.parse(raw);

    if (!Array.isArray(parsed)) {
      cachedCategories = defaultCategories;
      return cachedCategories;
    }

    cachedCategories = parsed.map((category) => ({
      ...category,
      nameNp: category.nameNp ?? "",
      isVisible: category.isVisible ?? true,
    }));

    return cachedCategories;
  } catch {
    cachedCategories = defaultCategories;
    return cachedCategories;
  }
}

export function getServerCategoriesSnapshot(): AdminCategory[] {
  return defaultCategories;
}

export function subscribeToCategories(callback: () => void) {
  listeners.add(callback);

  const handleStorage = (event: StorageEvent) => {
    if (event.key === CATEGORY_KEY) {
      cachedRaw = undefined;
      callback();
    }
  };

  const handleCategoryUpdate = () => {
    callback();
  };

  window.addEventListener("storage", handleStorage);
  window.addEventListener(CATEGORY_EVENT, handleCategoryUpdate);

  callback();

  return () => {
    listeners.delete(callback);
    window.removeEventListener("storage", handleStorage);
    window.removeEventListener(CATEGORY_EVENT, handleCategoryUpdate);
  };
}

export function saveCategories(updatedCategories: AdminCategory[]) {
  const raw = JSON.stringify(updatedCategories);

  localStorage.setItem(CATEGORY_KEY, raw);

  cachedRaw = raw;
  cachedCategories = updatedCategories;

  window.dispatchEvent(new Event(CATEGORY_EVENT));
  notifyListeners();
}
