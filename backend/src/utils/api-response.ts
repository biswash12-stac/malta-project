import type { Response } from "express";

export type ApiSuccess<T> = {
  success: true;
  data: T;
  message?: string;
};

export type ApiError = {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
};

export const sendSuccess = <T>(
  res: Response,
  data: T,
  statusCode = 200,
  message?: string
): Response => {
  const body: ApiSuccess<T> = { success: true, data };
  if (message) body.message = message;
  return res.status(statusCode).json(body);
};
