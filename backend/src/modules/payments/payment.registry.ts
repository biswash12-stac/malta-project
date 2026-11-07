import { codProvider } from "./cod.provider.js";
import type { PaymentMethod, PaymentProvider } from "./payment.types.js";

export const paymentProviders: Record<PaymentMethod, PaymentProvider> = {
  COD: codProvider,
};
