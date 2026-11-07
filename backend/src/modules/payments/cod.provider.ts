import type { PaymentProvider } from "./payment.types.js";

// Cash is collected on delivery, so nothing happens here until the admin marks the order paid.
export const codProvider: PaymentProvider = {
  createPayment: async () => {},
  verifyPayment: async () => {},
  refund: async () => {},
};
