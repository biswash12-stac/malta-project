
export type OrderStatus =
  | "PENDING"
  | "CONFIRMED"
  | "PROCESSING"
  | "SHIPPED"
  | "DELIVERED"
  | "CANCELLED";

export type PaymentStatus = "PAID" | "UNPAID";

export type OrderItem = {
  productId: number;
  name: string;
  nameNp?: string;
  image: string;
  price: number;
  quantity: number;
};

export type AdminOrder = {
  id: string;
  orderNumber: string;

  customer: {
    name: string;
    email: string;
    phone: string;
    address: string;
    city: string;
  };

  items: OrderItem[];

  subtotal: number;
  deliveryCharge: number;
  total: number;

  paymentMethod: "CASH_ON_DELIVERY" | "BANK_TRANSFER" | "MOBILE_WALLET";
  paymentStatus: PaymentStatus;

  status: OrderStatus;

  estimatedDeliveryDate?: string;
  createdAt: string;
  updatedAt: string;
};

const ORDER_KEY = "malta-orders";
const ORDER_EVENT = "malta-orders-updated";

// Temporary demo orders.
// These will eventually be replaced by orders from your backend.
const defaultOrders: AdminOrder[] = [
  {
    id: "order-001",
    orderNumber: "MLT-1001",
    customer: {
      name: "Ram Sharma",
      email: "ram@example.com",
      phone: "9800000001",
      address: "Ward 5, Imadol",
      city: "Lalitpur",
    },
    items: [
      {
        productId: 1,
        name: "Fresh Organic Apples",
        nameNp: "ताजा अर्गानिक स्याउ",
        image: "/products/apple.jpg",
        price: 250,
        quantity: 2,
      },
      {
        productId: 2,
        name: "Fresh Bananas",
        nameNp: "ताजा केरा",
        image: "/products/banana.jpg",
        price: 120,
        quantity: 1,
      },
    ],
    subtotal: 620,
    deliveryCharge: 50,
    total: 670,
    paymentMethod: "CASH_ON_DELIVERY",
    paymentStatus: "UNPAID",
    status: "PENDING",
    createdAt: "2026-11-10T09:30:00.000Z",
    updatedAt: "2026-11-10T09:30:00.000Z",
  },
  {
    id: "order-002",
    orderNumber: "MLT-1002",
    customer: {
      name: "Sita Thapa",
      email: "sita@example.com",
      phone: "9800000002",
      address: "Baneshwor",
      city: "Kathmandu",
    },
    items: [
      {
        productId: 3,
        name: "Whole Milk",
        nameNp: "दूध",
        image: "/products/milk.jpg",
        price: 100,
        quantity: 3,
      },
    ],
    subtotal: 300,
    deliveryCharge: 50,
    total: 350,
    paymentMethod: "MOBILE_WALLET",
    paymentStatus: "PAID",
    status: "CONFIRMED",
    estimatedDeliveryDate: "2026-11-12",
    createdAt: "2026-11-09T11:00:00.000Z",
    updatedAt: "2026-11-09T12:00:00.000Z",
  },
];

const listeners = new Set<() => void>();

let cachedRaw: string | null = null;
let cachedOrders: AdminOrder[] = defaultOrders;

function readOrders(): AdminOrder[] {
  if (typeof window === "undefined") {
    return defaultOrders;
  }

  try {
    const raw = localStorage.getItem(ORDER_KEY);

    if (!raw) {
      localStorage.setItem(ORDER_KEY, JSON.stringify(defaultOrders));
      cachedRaw = JSON.stringify(defaultOrders);
      cachedOrders = defaultOrders;
      return cachedOrders;
    }

    if (raw !== cachedRaw) {
      cachedRaw = raw;
      cachedOrders = JSON.parse(raw) as AdminOrder[];
    }

    return cachedOrders;
  } catch {
    return defaultOrders;
  }
}

export function getOrdersSnapshot(): AdminOrder[] {
  return readOrders();
}

export function getServerOrdersSnapshot(): AdminOrder[] {
  return defaultOrders;
}

export function subscribeToOrders(callback: () => void) {
  listeners.add(callback);

  if (typeof window !== "undefined") {
    window.addEventListener("storage", handleStorageChange);
    window.addEventListener(ORDER_EVENT, callback);
  }

  return () => {
    listeners.delete(callback);

    if (typeof window !== "undefined") {
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener(ORDER_EVENT, callback);
    }
  };
}

function handleStorageChange(event: StorageEvent) {
  if (event.key === ORDER_KEY) {
    cachedRaw = null;

    listeners.forEach((listener) => listener());
  }
}

export function saveOrders(orders: AdminOrder[]) {
  if (typeof window === "undefined") return;

  const raw = JSON.stringify(orders);

  localStorage.setItem(ORDER_KEY, raw);

  cachedRaw = raw;
  cachedOrders = orders;

  window.dispatchEvent(new Event(ORDER_EVENT));

  listeners.forEach((listener) => listener());
}

export function updateOrder(
  orderId: string,
  updates: Partial<AdminOrder>,
) {
  const orders = getOrdersSnapshot();

  const updatedOrders = orders.map((order) =>
    order.id === orderId
      ? {
          ...order,
          ...updates,
          updatedAt: new Date().toISOString(),
        }
      : order,
  );

  saveOrders(updatedOrders);
}

export function getOrderById(orderId: string) {
  return getOrdersSnapshot().find((order) => order.id === orderId);
}
