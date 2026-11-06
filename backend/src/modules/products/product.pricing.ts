import { AppError } from "../../utils/app-error.js";
import type { PriceRecord } from "./product.model.js";

const WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

type PricedProduct = {
  price: number;
  offerPrice: number | null;
  priorLowestPrice: number | null;
  priceHistory: PriceRecord[];
};

// Prices charged during the last 30 days. Includes the price that was already
// in effect when the window opened, and drops anything older.
export const pricesInWindow = (history: PriceRecord[], now: Date): PriceRecord[] => {
  const start = now.getTime() - WINDOW_MS;
  const inWindow = history.filter(({ from }) => from.getTime() > start);
  const inEffectAtStart = history.filter(({ from }) => from.getTime() <= start).at(-1);
  return inEffectAtStart ? [inEffectAtStart, ...inWindow] : inWindow;
};

// Call after changing prices and before saving. `previousPrice` is what customers paid
// before this change, or null for a new product.
export const applyPriceRules = (
  product: PricedProduct,
  previousPrice: number | null,
  now = new Date()
): void => {
  const history = pricesInWindow(
    product.priceHistory.map(({ price, from }) => ({ price, from })),
    now
  );

  if (product.offerPrice === null) {
    product.priorLowestPrice = null;
  } else {
    // Fixed when the offer starts, so lowering an offer in steps keeps the same reference.
    product.priorLowestPrice ??=
      history.length > 0 ? Math.min(...history.map(({ price }) => price)) : product.price;

    if (product.offerPrice >= product.priorLowestPrice) {
      throw AppError.badRequest("Invalid input", {
        offerPrice: ["Offer price must be lower than the lowest price of the last 30 days"],
      });
    }
  }

  const currentPrice = product.offerPrice ?? product.price;
  product.priceHistory =
    currentPrice === previousPrice ? history : [...history, { price: currentPrice, from: now }];
};
