import { createHash } from "node:crypto";
import { env } from "../../config/env.js";
import { AppError } from "../../utils/app-error.js";
import { logger } from "../../utils/logger.js";

export const UPLOAD_FOLDER = "products";
const ALLOWED_FORMAT_LIST = ["jpg", "jpeg", "png", "webp"];
const ALLOWED_FORMATS = ALLOWED_FORMAT_LIST.join(",");
// For the browser's own check before uploading. The server check below is the one that counts.
const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];

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
    allowedMimeTypes: ALLOWED_MIME_TYPES,
    maxFileBytes: env.UPLOAD_MAX_BYTES,
    signature: sign({
      allowed_formats: ALLOWED_FORMATS,
      folder: UPLOAD_FOLDER,
      timestamp,
    }),
  };
};

// An object, so tests can replace destroy() and getImage() and never touch a real account.
export const cloudinary = {
  // Size and format as Cloudinary stored them, or null if there's no such image.
  getImage: async (publicId: string): Promise<{ bytes: number; format: string } | null> => {
    const path = publicId.split("/").map(encodeURIComponent).join("/");
    const credentials = Buffer.from(
      `${env.CLOUDINARY_API_KEY}:${env.CLOUDINARY_API_SECRET}`
    ).toString("base64");
    const res = await fetch(
      `https://api.cloudinary.com/v1_1/${env.CLOUDINARY_CLOUD_NAME}/resources/image/upload/${path}`,
      { headers: { authorization: `Basic ${credentials}` }, signal: AbortSignal.timeout(10_000) }
    );
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`Cloudinary answered ${res.status}`);
    const { bytes, format } = (await res.json()) as { bytes?: unknown; format?: unknown };
    // A record we can't read is an error, not an image: the caller then refuses the save (503)
    // and deletes nothing, because it can't tell whether the file is acceptable.
    if (typeof bytes !== "number" || !Number.isFinite(bytes) || typeof format !== "string") {
      throw new Error("Cloudinary sent an unexpected image record");
    }
    return { bytes, format };
  },

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

// The browser uploads straight to Cloudinary, and a signature can't limit file size, so the size
// and real stored format are checked here, before a product may use the image. Rejected files are
// deleted, which is safe because callers only pass images no product uses yet.
export const assertImagesAllowed = async (publicIds: string[]): Promise<void> => {
  if (!isConfigured() || publicIds.length === 0) return;

  const images = await Promise.all(
    publicIds.map((publicId) => cloudinary.getImage(publicId))
  ).catch(() => {
    throw new AppError(503, "IMAGE_CHECK_UNAVAILABLE", "Images can't be checked right now");
  });

  const maxMb = Math.round((env.UPLOAD_MAX_BYTES / (1024 * 1024)) * 10) / 10;
  const problems: string[] = [];
  const rejected: string[] = [];
  images.forEach((stored, i) => {
    const publicId = publicIds[i] ?? "";
    if (!stored) {
      problems.push(`${publicId}: image not found`);
    } else if (!ALLOWED_FORMAT_LIST.includes(stored.format)) {
      problems.push(`${publicId}: must be a JPG, PNG or WebP image`);
      rejected.push(publicId);
    } else if (stored.bytes > env.UPLOAD_MAX_BYTES) {
      problems.push(`${publicId}: larger than ${maxMb} MB`);
      rejected.push(publicId);
    }
  });
  if (problems.length > 0) {
    deleteImagesInBackground(rejected);
    throw AppError.badRequest("Invalid input", { images: problems });
  }
};
