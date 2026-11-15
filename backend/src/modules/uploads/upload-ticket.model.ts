import { Schema, model, type Types } from "mongoose";

// One ticket per file the cleanup job may have to delete: a signed upload, or an image an edit took
// off a product. The server chose the file's public_id, so a ticket is positive proof the file is
// ours. Saves only claim tickets; only the cleanup removes them, after checking whether a product
// uses the image (it keeps the file if one does).
// No TTL index: MongoDB could drop a ticket before its file is deleted, losing track of the file.
export type UploadTicket = {
  publicId: string;
  // "upload": signed but not yet saved on a product; deleted after 24 hours if never saved.
  // "removed": an edit took the image off a product; deleted after a short grace period, unless a
  // product uses it again by then. Older tickets without a reason are uploads.
  reason: "upload" | "removed";
  removedFrom?: Types.ObjectId;
  createdBy?: Types.ObjectId;
  createdAt: Date;
  // Set by a product save before it checks the image; cleanup leaves the ticket alone until then.
  claimedUntil?: Date | null;
  // Set by the cleanup worker that is deleting the file; a save is refused until it expires.
  deletingUntil?: Date | null;
  // Failed deletes back off, so a file that keeps failing never blocks newer tickets.
  attempts: number;
  nextAttemptAt?: Date | null;
  lastError?: string;
  // Bumped whenever an edit queues this image for removal. A cleanup worker only writes to the
  // ticket while it still has the revision it claimed, so a removal arriving mid-run can't be
  // dropped by the worker's older "still in use" decision. Missing on tickets created before it.
  rev?: number;
};

const uploadTicketSchema = new Schema<UploadTicket>(
  {
    publicId: { type: String, required: true, unique: true },
    reason: { type: String, enum: ["upload", "removed"], default: "upload", required: true },
    removedFrom: { type: Schema.Types.ObjectId, ref: "Product" },
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
    createdAt: { type: Date, required: true, default: Date.now, index: true },
    claimedUntil: { type: Date, default: null },
    deletingUntil: { type: Date, default: null },
    attempts: { type: Number, required: true, default: 0 },
    nextAttemptAt: { type: Date, default: null },
    lastError: { type: String },
    // No default: an upsert that $inc's it must not also get a $setOnInsert for the same field.
    rev: { type: Number },
  },
  { versionKey: false }
);

export const UploadTicketModel = model<UploadTicket>("UploadTicket", uploadTicketSchema);
