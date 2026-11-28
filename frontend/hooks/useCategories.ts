
"use client";

import { useSyncExternalStore } from "react";

import {
  getCategoriesSnapshot,
  getServerCategoriesSnapshot,
  subscribeToCategories,
} from "@/lib/category-storage";

export function useCategories() {
  return useSyncExternalStore(
    subscribeToCategories,
    getCategoriesSnapshot,
    getServerCategoriesSnapshot
  );
}
