import { createHash } from "node:crypto";
import { env } from "../../config/env.js";
import { AppError } from "../../utils/app-error.js";
import { logger } from "../../utils/logger.js";

export const UPLOAD_FOLDER = "products";
const ALLOWED_FORMATS = "jpg,jpeg,png,webp";

const apiUrl = (action: string) =>
  `https://api.cloudinary.com/v1_1/${env.CLOUDINARY_CLOUD_NAME}/image/${action}`;

const isConfigured = () =>
  Boolean(env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET);

// Cloudinary's rule: sort the parameters, join them, add the secret, and hash with SHA-1.
const sign = (params: Record<string, string | number>): string => {
  const joined = Object.keys(params)
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join("&");
  return createHash("sha1")
    .update(joined + env.CLOUDINARY_API_SECRET)
    .digest("hex");
};

const nowInSeconds = () => Math.floor(Date.now() / 1000);

// Lets the browser send one or more images straight to Cloudinary. The signature fixes the folder
// and formats, and Cloudinary rejects it after about an hour. The API secret never leaves here.
export const createUploadSignature = () => {
  if (!isConfigured()) {
    throw new AppError(503, "UPLOADS_NOT_CONFIGURED", "Image uploads are not available");
  }
  const timestamp = nowInSeconds();
  return {
    uploadUrl: apiUrl("upload"),
    apiKey: env.CLOUDINARY_API_KEY,
    timestamp,
    folder: UPLOAD_FOLDER,
    allowedFormats: ALLOWED_FORMATS,
    signature: sign({
      allowed_formats: ALLOWED_FORMATS,
      folder: UPLOAD_FOLDER,
      timestamp,
    }),
  };
};

// An object, so tests can replace destroy() and never touch a real account.
export const cloudinary = {
  destroy: async (publicId: string): Promise<void> => {
    const timestamp = nowInSeconds();
    const res = await fetch(apiUrl("destroy"), {
      method: "POST",
      body: new URLSearchParams({
        public_id: publicId,
        timestamp: String(timestamp),
        api_key: env.CLOUDINARY_API_KEY,
        signature: sign({ public_id: publicId, timestamp }),
      }),
      signal: AbortSignal.timeout(10_000),
    });
    const { result } = (await res.json()) as { result?: string };
    // "not found" means the file is already gone, which is what we wanted.
    if (result !== "ok" && result !== "not found") {
      throw new Error(`Cloudinary answered ${res.status}`);
    }
  },
};

// Runs in the background: a leftover file only costs storage, so it must never fail a product edit.
export const deleteImagesInBackground = (publicIds: string[]): void => {
  if (!isConfigured()) return;
  for (const publicId of publicIds) {
    cloudinary.destroy(publicId).catch((err: unknown) => {
      logger.error({ msg: "Could not delete image", publicId, err: String(err) });
    });
  }
};
