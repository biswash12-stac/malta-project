import type { PaginationQuery } from "./common.schema.js";

export const skipFor = ({ page, limit }: PaginationQuery): number => (page - 1) * limit;

export const pageOf = <T>(items: T[], total: number, { page, limit }: PaginationQuery) => ({
  items,
  pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
});
