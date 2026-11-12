
"use client";

import { useSyncExternalStore } from "react";

import {
  getProductsSnapshot,
  getServerProductsSnapshot,
  subscribeToProducts,
} from "@/lib/product-storage";

export function useProducts() {
  return useSyncExternalStore(
    subscribeToProducts,
    getProductsSnapshot,
    getServerProductsSnapshot
  );
}
