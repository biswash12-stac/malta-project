import type { Request, Response } from "express";
import { sendSuccess } from "../../utils/api-response.js";
import type { PaginationQuery } from "../../utils/common.schema.js";
import {
  createCategory,
  deactivateCategory,
  listActiveCategories,
  listAllCategories,
  updateCategory,
} from "./category.service.js";

const paginationOf = (req: Request) => req.query as unknown as PaginationQuery;

export const listActiveHandler = async (req: Request, res: Response) => {
  sendSuccess(res, await listActiveCategories(paginationOf(req)));
};

export const listAllHandler = async (req: Request, res: Response) => {
  sendSuccess(res, await listAllCategories(paginationOf(req)));
};

export const createHandler = async (req: Request, res: Response) => {
  sendSuccess(res, { category: await createCategory(req.body) }, 201);
};

export const updateHandler = async (req: Request<{ id: string }>, res: Response) => {
  sendSuccess(res, { category: await updateCategory(req.params.id, req.body) });
};

export const deleteHandler = async (req: Request<{ id: string }>, res: Response) => {
  await deactivateCategory(req.params.id);
  sendSuccess(res, null);
};
