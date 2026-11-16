import mongoose from "mongoose";

// A lease lock in MongoDB, so a scheduled job never runs twice at once, even with several API
// instances. The lease expires on its own, so a crashed run cannot block the job forever.
type JobLock = { _id: string; owner: string; lockedUntil: Date };

const locks = () => mongoose.connection.collection<JobLock>("joblocks");

export const acquireJobLock = async (name: string, owner: string, now: Date, leaseMs: number) => {
  try {
    // Matches a free or expired lock. When the lock is held, the upsert tries to insert a second
    // document with the same _id, which the unique _id index rejects.
    await locks().findOneAndUpdate(
      { _id: name, lockedUntil: { $lte: now } },
      { $set: { owner, lockedUntil: new Date(now.getTime() + leaseMs) } },
      { upsert: true }
    );
    return true;
  } catch (err) {
    if ((err as { code?: unknown }).code === 11000) return false;
    throw err;
  }
};

// Extends the lease while the owner still holds it. False means another worker took over, so the
// caller must stop. Renewing after each unit of work means a long run never outlives its lease.
export const renewJobLock = async (name: string, owner: string, now: Date, leaseMs: number) => {
  const { matchedCount } = await locks().updateOne(
    { _id: name, owner },
    { $set: { lockedUntil: new Date(now.getTime() + leaseMs) } }
  );
  return matchedCount === 1;
};

export const releaseJobLock = async (name: string, owner: string, now: Date) => {
  await locks().updateOne({ _id: name, owner }, { $set: { lockedUntil: now } });
};
