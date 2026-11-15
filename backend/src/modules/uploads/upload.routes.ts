import { Router } from "express";
import { requireAuth } from "../../middlewares/auth.middleware.js";
import { uploadSignatureRateLimit } from "../../middlewares/rate-limit.middleware.js";
import { requireRole } from "../../middlewares/role.middleware.js";
import { sendSuccess } from "../../utils/api-response.js";
import { AppError } from "../../utils/app-error.js";
import { createUploadSignature } from "./upload.service.js";

export const uploadRoutes = Router();

uploadRoutes.post(
  "/signature",
  requireAuth,
  requireRole("admin"),
  uploadSignatureRateLimit,
  async (req, res) => {
    if (!req.user) throw AppError.unauthorized();
    sendSuccess(res, await createUploadSignature(req.user.id));
  }
);
