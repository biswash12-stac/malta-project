
import { categories as initialCategories } from "@/data/products";

export type AdminCategory = {
  id: string;
  name: string;
  nameNp: string;
  isVisible: boolean;
};

const CATEGORY_KEY = "malta-categories";
const CATEGORY_EVENT = "malta-categories-updated";

const defaultCategories: AdminCategory[] = initialCategories
  .filter((name) => name !== "All")
  .map((name) => ({
    id: name.toLowerCase().replace(/\s+/g, "-"),
    name,
    nameNp: "",
    isVisible: true,
  }));

let cachedRaw: string | null | undefined;
let cachedCategories: AdminCategory[] = defaultCategories;

const listeners = new Set<() => void>();

function notifyListeners() {
  listeners.forEach((listener) => listener());
}

function getValidCategories(data: unknown): AdminCategory[] {
  if (!Array.isArray(data)) return defaultCategories;

  return data.filter(
    (category): category is AdminCategory =>
      typeof category?.id === "string" &&
      typeof category?.name === "string"
  ).map((category) => ({
    id: category.id,
    name: category.name,
    nameNp:
      typeof category.nameNp === "string" ? category.nameNp : "",
    isVisible:
      typeof category.isVisible === "boolean"
        ? category.isVisible
        : true,
  }));
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
    cachedCategories = getValidCategories(JSON.parse(raw));
  } catch {
    cachedCategories = defaultCategories;
  }

  return cachedCategories;
}

export function getServerCategoriesSnapshot(): AdminCategory[] {
  return defaultCategories;
}

export function subscribeToCategories(callback: () => void) {
  listeners.add(callback);

  const handleStorage = (event: StorageEvent) => {
    if (event.key === CATEGORY_KEY || event.key === null) {
      cachedRaw = undefined;
      notifyListeners();
    }
  };

  const handleCategoryUpdate = () => {
    cachedRaw = undefined;
    notifyListeners();
  };

  window.addEventListener("storage", handleStorage);
  window.addEventListener(CATEGORY_EVENT, handleCategoryUpdate);

  return () => {
    listeners.delete(callback);
    window.removeEventListener("storage", handleStorage);
    window.removeEventListener(CATEGORY_EVENT, handleCategoryUpdate);
  };
}

export function saveCategories(updatedCategories: AdminCategory[]) {
  if (typeof window === "undefined") return;

  const raw = JSON.stringify(updatedCategories);

  localStorage.setItem(CATEGORY_KEY, raw);

  cachedRaw = raw;
  cachedCategories = updatedCategories;

  window.dispatchEvent(new Event(CATEGORY_EVENT));
}
