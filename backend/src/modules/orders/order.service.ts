import mongoose, { Types, type HydratedDocument, type QueryFilter } from "mongoose";
import { AppError } from "../../utils/app-error.js";
import type { PaginationQuery } from "../../utils/common.schema.js";
import { pageOf, skipFor } from "../../utils/pagination.js";
import { paymentProviders } from "../payments/payment.registry.js";
import { ProductModel } from "../products/product.model.js";
import { notInHiddenCategory } from "../products/product.service.js";
import { nextOrderNumber, startOfMaltaDay } from "./order-number.js";
import { OrderModel, type Order, type OrderHistoryEntry } from "./order.model.js";
import { normalizePhone, type AdminOrderQuery, type PlaceOrderInput } from "./order.schema.js";
import { canTransition, isFinalStatus, type OrderStatus } from "./order.status.js";

const MIN_ORDER_CENTS = 2000;
const FREE_DELIVERY_FROM_CENTS = 3000;
const DELIVERY_FEE_CENTS = 500;

const CUSTOMER_LIST_FIELDS =
  "orderNumber total status paymentStatus estimatedDeliveryDate createdAt";
const CUSTOMER_DETAIL_EXCLUDED = "-user -__v -statusHistory.by -statusHistory.note";
const ADMIN_LIST_FIELDS = `${CUSTOMER_LIST_FIELDS} delivery.name delivery.phone delivery.locality`;

const itemsUnavailable = (items: { productId: string; available: number }[]) =>
  new AppError(409, "ITEMS_UNAVAILABLE", "Some items are no longer available", { items });

export const placeOrder = async (userId: string, { items, delivery }: PlaceOrderInput) => {
  const visible = await notInHiddenCategory();

  const order = await mongoose.connection.transaction(async (session) => {
    const products = await ProductModel.find({
      _id: { $in: items.map(({ productId }) => productId) },
      isActive: true,
      ...visible,
    })
      .select("nameEn unit price offerPrice stock")
      .session(session)
      .lean();
    const byId = new Map(products.map((product) => [String(product._id), product]));

    const unavailable = items.filter(
      ({ productId, qty }) => (byId.get(productId)?.stock ?? 0) < qty
    );
    if (unavailable.length > 0) {
      throw itemsUnavailable(
        unavailable.map(({ productId }) => ({
          productId,
          available: byId.get(productId)?.stock ?? 0,
        }))
      );
    }

    const lines = products.map((product) => ({
      productId: product._id,
      nameSnapshot: product.nameEn,
      unitSnapshot: product.unit,
      priceSnapshot: product.offerPrice ?? product.price,
      qty: items.find(({ productId }) => productId === String(product._id))?.qty ?? 0,
    }));
    const subtotal = lines.reduce((sum, line) => sum + line.priceSnapshot * line.qty, 0);
    if (subtotal < MIN_ORDER_CENTS) {
      throw new AppError(400, "MINIMUM_ORDER_NOT_MET", "The order is below the minimum amount", {
        minimum: MIN_ORDER_CENTS,
        subtotal,
      });
    }
    const deliveryFee = subtotal >= FREE_DELIVERY_FROM_CENTS ? 0 : DELIVERY_FEE_CENTS;

    // The stock condition stays even after the check above: it's what stops overselling.
    const { modifiedCount } = await ProductModel.bulkWrite(
      items.map(({ productId, qty }) => ({
        updateOne: {
          filter: { _id: productId, stock: { $gte: qty } },
          update: { $inc: { stock: -qty } },
        },
      })),
      { session }
    );
    if (modifiedCount !== items.length) throw itemsUnavailable([]);

    const by = new Types.ObjectId(userId);
    const created = new OrderModel({
      orderNumber: await nextOrderNumber(),
      user: by,
      items: lines,
      subtotal,
      deliveryFee,
      total: subtotal + deliveryFee,
      delivery,
      statusHistory: [{ status: "pending", at: new Date(), by }],
    });
    await created.save({ session });
    return created;
  });

  await paymentProviders[order.paymentMethod].createPayment(order);
  return getMyOrder(userId, order.id);
};

export const listMyOrders = async (userId: string, pagination: PaginationQuery) => {
  const filter = { user: userId };
  const [items, total] = await Promise.all([
    OrderModel.find(filter)
      .select(CUSTOMER_LIST_FIELDS)
      .sort({ createdAt: -1, _id: -1 })
      .skip(skipFor(pagination))
      .limit(pagination.limit)
      .lean(),
    OrderModel.countDocuments(filter),
  ]);
  return pageOf(items, total, pagination);
};

// A status never repeats, and later entries with the same status are admin edits, not timeline steps.
const timelineOf = (history: Pick<OrderHistoryEntry, "status" | "at">[]) =>
  history.filter(({ status }, i) => history.findIndex((h) => h.status === status) === i);

// 404, not 403, so customers can't learn which order ids exist.
export const getMyOrder = async (userId: string, id: string) => {
  const order = await OrderModel.findOne({ _id: id, user: userId })
    .select(CUSTOMER_DETAIL_EXCLUDED)
    .lean();
  if (!order) throw AppError.notFound("Order not found");
  return { ...order, statusHistory: timelineOf(order.statusHistory) };
};

const searchFilter = (q: string): QueryFilter<Order> =>
  /^NG-/i.test(q) ? { orderNumber: q.toUpperCase() } : { "delivery.phone": normalizePhone(q) };

export const listAdminOrders = async ({ status, from, to, q, ...pagination }: AdminOrderQuery) => {
  const filter: QueryFilter<Order> = {
    ...(status && { status }),
    ...((from || to) && {
      createdAt: { ...(from && { $gte: from }), ...(to && { $lte: to }) },
    }),
    ...(q && searchFilter(q)),
  };
  const [items, total] = await Promise.all([
    OrderModel.find(filter)
      .select(ADMIN_LIST_FIELDS)
      .sort({ createdAt: -1, _id: -1 })
      .skip(skipFor(pagination))
      .limit(pagination.limit)
      .lean(),
    OrderModel.countDocuments(filter),
  ]);
  return pageOf(items, total, pagination);
};

export const getAdminOrder = async (id: string) => {
  const order = await OrderModel.findById(id)
    .select("-__v")
    .populate({ path: "user", select: "username email" })
    .lean();
  if (!order) throw AppError.notFound("Order not found");
  return order;
};

const logChange = (order: HydratedDocument<Order>, adminId: string, note = "") => {
  order.statusHistory.push({
    status: order.status,
    at: new Date(),
    by: new Types.ObjectId(adminId),
    note,
  });
};

// The transaction makes the status change and the stock return happen together, and a parallel
// change to the same order conflicts and retries, so a double cancel can't restore stock twice.
export const updateOrderStatus = async (
  adminId: string,
  id: string,
  status: OrderStatus,
  note?: string
) => {
  await mongoose.connection.transaction(async (session) => {
    const order = await OrderModel.findById(id).session(session);
    if (!order) throw AppError.notFound("Order not found");
    if (!canTransition(order.status, status)) {
      throw new AppError(
        409,
        "INVALID_STATUS_TRANSITION",
        `An order can't go from ${order.status} to ${status}`
      );
    }

    order.status = status;
    logChange(order, adminId, note);
    await order.save({ session });

    if (status === "cancelled") {
      await ProductModel.bulkWrite(
        order.items.map(({ productId, qty }) => ({
          updateOne: { filter: { _id: productId }, update: { $inc: { stock: qty } } },
        })),
        { session }
      );
    }
  });
  return getAdminOrder(id);
};

export const setDeliveryDate = async (adminId: string, id: string, date: Date | null) => {
  const order = await OrderModel.findById(id);
  if (!order) throw AppError.notFound("Order not found");
  if (isFinalStatus(order.status)) {
    throw AppError.conflict(`A ${order.status} order can't have its delivery date changed`);
  }

  order.estimatedDeliveryDate = date;
  const shown = date ? date.toISOString().slice(0, 10) : "cleared";
  logChange(order, adminId, `Estimated delivery date: ${shown}`);
  await order.save();
  return getAdminOrder(id);
};

export const markOrderPaid = async (adminId: string, id: string) => {
  const order = await OrderModel.findById(id);
  if (!order) throw AppError.notFound("Order not found");
  if (order.status !== "delivered") {
    throw AppError.conflict("Only a delivered order can be marked as paid");
  }
  if (order.paymentStatus !== "pending") {
    throw AppError.conflict(`This order's payment is already ${order.paymentStatus}`);
  }

  order.paymentStatus = "paid";
  logChange(order, adminId, "Cash collected");
  await order.save();
  return getAdminOrder(id);
};

// FR-18. Totals are integer cents, and "today" follows Malta's calendar.
export const getAdminStats = async () => {
  const [revenue, ordersToday, pendingOrders] = await Promise.all([
    OrderModel.aggregate<{ total: number }>([
      { $match: { $or: [{ status: "delivered" }, { paymentStatus: "paid" }] } },
      { $group: { _id: null, total: { $sum: "$total" } } },
    ]),
    OrderModel.countDocuments({ createdAt: { $gte: startOfMaltaDay() } }),
    OrderModel.countDocuments({ status: "pending" }),
  ]);
  return { totalRevenue: revenue[0]?.total ?? 0, ordersToday, pendingOrders };
};
