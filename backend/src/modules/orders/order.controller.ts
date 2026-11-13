import type { Request, Response } from "express";
import { sendSuccess } from "../../utils/api-response.js";
import { AppError } from "../../utils/app-error.js";
import type { PaginationQuery } from "../../utils/common.schema.js";
import type { AdminOrderQuery } from "./order.schema.js";
import {
  getAdminOrder,
  getAdminStats,
  getMyOrder,
  listAdminOrders,
  listMyOrders,
  markOrderPaid,
  placeOrder,
  setDeliveryDate,
  updateOrderStatus,
} from "./order.service.js";

const currentUserId = (req: Request<any>) => {
  if (!req.user) throw AppError.unauthorized();
  return req.user.id;
};

export const placeHandler = async (req: Request, res: Response) => {
  sendSuccess(res, { order: await placeOrder(currentUserId(req), req.body) }, 201);
};

export const listMineHandler = async (req: Request, res: Response) => {
  sendSuccess(res, await listMyOrders(currentUserId(req), req.query as unknown as PaginationQuery));
};

export const getMineHandler = async (req: Request<{ id: string }>, res: Response) => {
  sendSuccess(res, { order: await getMyOrder(currentUserId(req), req.params.id) });
};

export const listAdminHandler = async (req: Request, res: Response) => {
  sendSuccess(res, await listAdminOrders(req.query as unknown as AdminOrderQuery));
};

export const getAdminHandler = async (req: Request<{ id: string }>, res: Response) => {
  sendSuccess(res, { order: await getAdminOrder(req.params.id) });
};

export const updateStatusHandler = async (req: Request<{ id: string }>, res: Response) => {
  const { status, note } = req.body;
  const order = await updateOrderStatus(currentUserId(req), req.params.id, status, note);
  sendSuccess(res, { order });
};

export const updateDeliveryDateHandler = async (req: Request<{ id: string }>, res: Response) => {
  const date = req.body.estimatedDeliveryDate;
  sendSuccess(res, { order: await setDeliveryDate(currentUserId(req), req.params.id, date) });
};

export const updatePaymentHandler = async (req: Request<{ id: string }>, res: Response) => {
  sendSuccess(res, { order: await markOrderPaid(currentUserId(req), req.params.id) });
};

export const statsHandler = async (_req: Request, res: Response) => {
  sendSuccess(res, await getAdminStats());
};
