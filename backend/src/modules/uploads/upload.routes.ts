import { Router } from "express";
import { requireAuth } from "../../middlewares/auth.middleware.js";
import { requireRole } from "../../middlewares/role.middleware.js";
import { sendSuccess } from "../../utils/api-response.js";
import { createUploadSignature } from "./upload.service.js";

export const uploadRoutes = Router();

uploadRoutes.post("/signature", requireAuth, requireRole("admin"), (_req, res) => {
  sendSuccess(res, createUploadSignature());
});
