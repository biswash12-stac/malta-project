import { createHash, randomUUID } from "node:crypto";
import { Types } from "mongoose";
import { env } from "../../config/env.js";
import { AppError } from "../../utils/app-error.js";
import { UploadTicketModel } from "./upload-ticket.model.js";

export const UPLOAD_FOLDER = "products";
const ALLOWED_FORMAT_LIST = ["jpg", "jpeg", "png", "webp"];
const ALLOWED_FORMATS = ALLOWED_FORMAT_LIST.join(",");
// For the browser's own check before uploading. The server check below is the one that counts.
const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];

const apiUrl = (action: string) =>
  `https://api.cloudinary.com/v1_1/${env.CLOUDINARY_CLOUD_NAME}/image/${action}`;

export const isCloudinaryConfigured = () =>
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

// Lets the browser send one image straight to Cloudinary. The server chooses the file's public_id
// and signs it with the allowed formats, so the file can only land at that name, and Cloudinary
// rejects the signature after about an hour. A ticket records the name, which is how the cleanup
// job later recognises an abandoned upload. The API secret never leaves here.
export const createUploadSignature = async (adminId: string) => {
  if (!isCloudinaryConfigured()) {
    throw new AppError(503, "UPLOADS_NOT_CONFIGURED", "Image uploads are not available");
  }
  const timestamp = nowInSeconds();
  const publicId = `${UPLOAD_FOLDER}/${randomUUID()}`;
  await UploadTicketModel.create({ publicId, createdBy: adminId });
  return {
    uploadUrl: apiUrl("upload"),
    apiKey: env.CLOUDINARY_API_KEY,
    timestamp,
    publicId,
    // Signed, so the browser must send it: a file can't later replace an image already checked.
    overwrite: false,
    allowedFormats: ALLOWED_FORMATS,
    allowedMimeTypes: ALLOWED_MIME_TYPES,
    maxFileBytes: env.UPLOAD_MAX_BYTES,
    signature: sign({
      allowed_formats: ALLOWED_FORMATS,
      overwrite: "false",
      public_id: publicId,
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

// The browser uploads straight to Cloudinary, and a signature can't limit file size, so the size
// and real stored format are checked here, before a product may use the image. Rejected files are
// queued for removal; the cleanup deletes them later under its claim and in-use rules.
export const assertImagesAllowed = async (publicIds: string[]): Promise<void> => {
  if (!isCloudinaryConfigured() || publicIds.length === 0) return;

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
    // Queued, not deleted here: the cleanup deletes them under its claim and in-use rules.
    await queueImageRemoval(rejected);
    throw AppError.badRequest("Invalid input", { images: problems });
  }
};

// The one rule for every ticket lease (claimedUntil, deletingUntil, nextAttemptAt): free when empty or
// already past. Saves and the cleanup job must agree on it, or their mutual exclusion breaks.
export const leaseIsFree = (field: string, at: Date) => ({
  $or: [{ [field]: null }, { [field]: { $lte: at } }],
});

// How long a product save holds its images' tickets. Far longer than a save takes (the Cloudinary
// check times out after 10 seconds), so the cleanup can never delete an image mid-save.
export const TICKET_CLAIM_MS = 15 * 60 * 1000;

// Claims the upload tickets of these images for a product save. One atomic update per ticket:
// it only succeeds while no cleanup worker is deleting the file. If cleanup got there first, the
// save is refused (the file is, or is about to be, gone). Images without a ticket are unaffected.
// Safe to repeat and safe for parallel saves of the same image: claims don't exclude each other.
export const claimUploadTickets = async (publicIds: string[], now = new Date()) => {
  if (publicIds.length === 0) return;
  await UploadTicketModel.updateMany(
    {
      publicId: { $in: publicIds },
      ...leaseIsFree("deletingUntil", now),
    },
    { $set: { claimedUntil: new Date(now.getTime() + TICKET_CLAIM_MS) } }
  );
  // Refused unless every ticket now holds a live save claim (this save's or another's) and no live
  // worker claim. Checking only for a worker claim missed one that was given back between the two
  // calls, which left the ticket unclaimed for the next worker to delete (R-14).
  const unprotected = await UploadTicketModel.exists({
    publicId: { $in: publicIds },
    $or: [{ deletingUntil: { $gt: now } }, ...leaseIsFree("claimedUntil", now).$or],
  });
  if (unprotected) {
    throw new AppError(
      409,
      "UPLOAD_EXPIRED",
      "An image upload has expired. Upload the image again"
    );
  }
};

// Removed images wait this long before the cleanup may delete them: as long as a save's claim, so a
// save that started before the removal (and found no ticket to claim) has finished by then.
export const REMOVAL_GRACE_MS = TICKET_CLAIM_MS;

// Queues images an edit is taking off a product for deletion, instead of deleting them straight
// away. The cleanup job deletes each one under the same rules as abandoned uploads: atomic claim,
// a fresh "is any product using it?" check, retries with back-off. Call before saving the product:
// if the save then fails, the image is still in use and the cleanup only drops the ticket.
// One upsert per image, so repeating it never duplicates a ticket.
export const queueImageRemoval = async (
  publicIds: string[],
  productId?: string,
  now = new Date()
) => {
  if (publicIds.length === 0) return;
  await UploadTicketModel.bulkWrite(
    publicIds.map((publicId) => ({
      updateOne: {
        filter: { publicId },
        update: {
          $set: {
            reason: "removed" as const,
            ...(productId && { removedFrom: new Types.ObjectId(productId) }),
          },
          // At least the grace period, but never earlier than a retry back-off already set.
          $max: { nextAttemptAt: new Date(now.getTime() + REMOVAL_GRACE_MS) },
          // Invalidates any cleanup worker's claim snapshot, so its pending write can't drop this.
          $inc: { rev: 1 },
          $setOnInsert: { createdAt: now, attempts: 0 },
        },
        upsert: true,
      },
    }))
  );
};
