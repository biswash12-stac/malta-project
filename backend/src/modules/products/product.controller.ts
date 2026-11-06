import type { Request, Response } from "express";
import { sendSuccess } from "../../utils/api-response.js";
import type { AdminProductQuery, PublicProductQuery } from "./product.schema.js";
import {
  createProduct,
  deactivateProduct,
  getAdminProduct,
  getPublicProduct,
  listAdminProducts,
  listPublicProducts,
  updateProduct,
} from "./product.service.js";

export const listPublicHandler = async (req: Request, res: Response) => {
  sendSuccess(res, await listPublicProducts(req.query as unknown as PublicProductQuery));
};

export const getPublicHandler = async (req: Request<{ slug: string }>, res: Response) => {
  sendSuccess(res, { product: await getPublicProduct(req.params.slug) });
};

export const listAdminHandler = async (req: Request, res: Response) => {
  sendSuccess(res, await listAdminProducts(req.query as unknown as AdminProductQuery));
};

export const getAdminHandler = async (req: Request<{ id: string }>, res: Response) => {
  sendSuccess(res, { product: await getAdminProduct(req.params.id) });
};

export const createHandler = async (req: Request, res: Response) => {
  sendSuccess(res, { product: await createProduct(req.body) }, 201);
};

export const updateHandler = async (req: Request<{ id: string }>, res: Response) => {
  sendSuccess(res, { product: await updateProduct(req.params.id, req.body) });
};

export const deleteHandler = async (req: Request<{ id: string }>, res: Response) => {
  await deactivateProduct(req.params.id);
  sendSuccess(res, null);
};
