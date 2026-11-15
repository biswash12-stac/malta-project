import { randomUUID } from "node:crypto";
import { acquireJobLock, releaseJobLock, renewJobLock } from "../../utils/job-lock.js";
import { logger } from "../../utils/logger.js";
import { ProductModel } from "../products/product.model.js";
import { UploadTicketModel } from "./upload-ticket.model.js";
import { cloudinary, isCloudinaryConfigured, leaseIsFree } from "./upload.service.js";

export const UPLOAD_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const LOCK_NAME = "upload-cleanup";
// The global lock only avoids wasted work: per-ticket claims below already stop two workers from
// handling the same file. The lease is renewed after every file, so a long run never outlives it,
// and a worker that loses it (renewal fails) stops at once.
const LOCK_LEASE_MS = 10 * 60 * 1000;
// How long a worker holds one ticket while deleting its file. Far longer than one delete (Cloudinary
// times out after 10 seconds); if the worker dies, the claim expires and another run takes over.
const DELETE_CLAIM_MS = 10 * 60 * 1000;
const RETRY_BASE_MS = 60 * 60 * 1000;
const RETRY_MAX_MS = 24 * 60 * 60 * 1000;

// 1 h, 2 h, 4 h, 8 h, 16 h, then daily. A failing file is never given up on, but it waits its turn.
export const retryDelayMs = (attempts: number) =>
  Math.min(RETRY_BASE_MS * 2 ** (attempts - 1), RETRY_MAX_MS);

export type UploadCleanupResult = {
  status: "ok" | "partial" | "lock-lost" | "skipped-locked" | "not-configured";
  checked: number;
  deleted: number;
  inUse: number;
  failed: number;
};

const empty = (status: UploadCleanupResult["status"]): UploadCleanupResult => ({
  status,
  checked: 0,
  deleted: 0,
  inUse: 0,
  failed: 0,
});

const isUsedByProduct = async (publicId: string) =>
  Boolean(await ProductModel.exists({ "images.publicId": publicId }));

// Atomically takes the oldest due ticket: older than the age limit, not claimed by a product save,
// not held by another live worker, and due for an attempt. Null when there is nothing left to do.
const claimNextTicket = (at: Date, maxAgeMs: number) =>
  UploadTicketModel.findOneAndUpdate(
    {
      // Removed images only wait for their grace period (nextAttemptAt); uploads wait 24 hours.
      $or: [{ reason: "removed" }, { createdAt: { $lt: new Date(at.getTime() - maxAgeMs) } }],
      $and: [
        leaseIsFree("claimedUntil", at),
        leaseIsFree("deletingUntil", at),
        leaseIsFree("nextAttemptAt", at),
      ],
    },
    { $set: { deletingUntil: new Date(at.getTime() + DELETE_CLAIM_MS) } },
    { sort: { createdAt: 1 }, returnDocument: "after" }
  )
    .select("publicId attempts deletingUntil rev")
    .lean();

// Deletes uploads the server signed but no product saved within 24 hours. Only ticketed files are
// touched, never a folder sweep, and never a file a product uses. Safe to repeat, to run on several
// instances and to interrupt: every step is guarded by the ticket claim, and Cloudinary treats
// deleting a missing file as success.
export const runUploadCleanup = async ({
  now,
  maxAgeMs = UPLOAD_MAX_AGE_MS,
  batchSize = 200,
}: { now?: Date; maxAgeMs?: number; batchSize?: number } = {}): Promise<UploadCleanupResult> => {
  if (!isCloudinaryConfigured()) return empty("not-configured");
  const clock = () => now ?? new Date();

  const owner = randomUUID();
  if (!(await acquireJobLock(LOCK_NAME, owner, clock(), LOCK_LEASE_MS))) {
    logger.info({ msg: "Upload cleanup skipped: another run holds the lock" });
    return empty("skipped-locked");
  }

  const result = empty("ok");
  try {
    while (result.checked < batchSize) {
      const at = clock();
      const ticket = await claimNextTicket(at, maxAgeMs);
      if (!ticket) break;
      result.checked++;
      const { publicId } = ticket;
      // Only act on the ticket while this worker's claim is still the one on it, and no edit has
      // queued a removal since (rev). Null matches tickets created before rev existed.
      const ours = {
        _id: ticket._id,
        deletingUntil: ticket.deletingUntil,
        rev: ticket.rev ?? null,
      };
      // An edit re-queued the ticket while this worker held it, so the worker's write missed. The
      // ticket now waits for its own grace period; only the claim is given back (matched on this
      // worker's lease alone), so saves of the image aren't refused for the rest of the lease.
      // A newer worker's claim has a later deletingUntil, so it never matches.
      const giveBackClaim = () =>
        UploadTicketModel.updateOne(
          { _id: ticket._id, deletingUntil: ours.deletingUntil },
          { $set: { deletingUntil: null } }
        );

      try {
        if (await isUsedByProduct(publicId)) {
          const { deletedCount } = await UploadTicketModel.deleteOne(ours);
          if (deletedCount === 1) result.inUse++;
          else await giveBackClaim();
        } else {
          // Re-take the claim right before deleting, in one atomic write. It succeeds only if this
          // worker's claim never lapsed (same value, still in the future), so no save can have
          // claimed the image since (a save only claims a lapsed one), and no edit re-queued it
          // (rev). The claim is renewed, so every save of the image is refused while Cloudinary
          // deletes it. A worker that stalled after its in-use check stops here instead.
          const confirmAt = clock();
          const confirmed = await UploadTicketModel.findOneAndUpdate(
            {
              ...ours,
              deletingUntil: { $eq: ours.deletingUntil, $gt: confirmAt },
              ...leaseIsFree("claimedUntil", confirmAt),
            },
            { $set: { deletingUntil: new Date(confirmAt.getTime() + DELETE_CLAIM_MS) } },
            { returnDocument: "after" }
          )
            .select("deletingUntil")
            .lean();
          if (!confirmed) {
            await giveBackClaim();
            logger.warn({ msg: "Upload cleanup skipped a file it no longer owned", publicId });
          } else {
            ours.deletingUntil = confirmed.deletingUntil;
            let destroyed = false;
            try {
              await cloudinary.destroy(publicId);
              destroyed = true;
            } catch (err) {
              // The claim is kept until it expires: after a timeout or an unreadable answer the
              // delete may still go through at Cloudinary, so saves of the file stay refused until
              // then. The back-off (1 hour or more) outlasts the claim, so retries aren't delayed.
              const attempts = (ticket.attempts ?? 0) + 1;
              const { matchedCount } = await UploadTicketModel.updateOne(ours, {
                $set: {
                  attempts,
                  nextAttemptAt: new Date(at.getTime() + retryDelayMs(attempts)),
                  lastError: String(err).slice(0, 500),
                },
              });
              // Re-queued mid-run: the new removal's schedule stands, so no back-off is recorded.
              result.failed++;
              logger.error({
                msg: "Upload cleanup could not delete a file",
                publicId,
                attempts,
                requeued: matchedCount === 0,
                err: String(err),
              });
            }
            if (destroyed) {
              // A database error here is caught below and is not a Cloudinary failure: no back-off.
              // The claim expires and the next run re-deletes (a missing file counts as deleted).
              // If an edit re-queued the ticket meanwhile, this misses and the claim is kept: the
              // file really is gone, so refusing saves of it until the claim expires is correct.
              await UploadTicketModel.deleteOne(ours);
              result.deleted++;
            }
          }
        }
      } catch (err) {
        // A database error on this ticket: count it, keep going. The ticket's claim expires on its
        // own, so a later run retries it.
        result.failed++;
        logger.error({ msg: "Upload cleanup failed on a ticket", publicId, err: String(err) });
      }

      if (!(await renewJobLock(LOCK_NAME, owner, clock(), LOCK_LEASE_MS))) {
        result.status = "lock-lost";
        logger.warn({ msg: "Upload cleanup stopped: another worker took the lock", ...result });
        return result;
      }
    }
    if (result.failed > 0) result.status = "partial";
    logger.info({ msg: "Upload cleanup finished", ...result });
    return result;
  } finally {
    // Never let a failed release hide the run's own error; the lease expires on its own anyway.
    await releaseJobLock(LOCK_NAME, owner, clock()).catch((err: unknown) => {
      logger.error({ msg: "Could not release the upload cleanup lock", err: String(err) });
    });
  }
};

const FIRST_RUN_DELAY_MS = 60 * 1000;
const RUN_EVERY_MS = 60 * 60 * 1000;

// Runs the cleanup inside the API process: once a minute after start, then every hour. The lock in
// runUploadCleanup keeps runs from overlapping, even across instances. Timers are unref'd so they
// never keep the process alive, and a failing run is logged instead of crashing the server.
export const startUploadCleanupSchedule = (
  run: () => Promise<UploadCleanupResult> = () => runUploadCleanup()
) => {
  const safeRun = () =>
    void run().catch((err: unknown) => {
      logger.error({ msg: "Upload cleanup run failed", err: String(err) });
    });
  let interval: NodeJS.Timeout | undefined;
  const first = setTimeout(() => {
    safeRun();
    interval = setInterval(safeRun, RUN_EVERY_MS);
    interval.unref();
  }, FIRST_RUN_DELAY_MS);
  first.unref();
  return () => {
    clearTimeout(first);
    if (interval) clearInterval(interval);
  };
};
