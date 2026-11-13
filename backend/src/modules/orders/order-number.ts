import { Schema, model } from "mongoose";

const OrderCounterModel = model(
  "OrderCounter",
  new Schema<{ _id: string; seq: number }>(
    { _id: { type: String, required: true }, seq: { type: Number, required: true } },
    { versionKey: false }
  )
);

// en-CA formats as YYYY-MM-DD. The day follows Malta's calendar, not the server's.
const maltaDay = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Malta" });
const maltaOffset = new Intl.DateTimeFormat("en-US", {
  timeZone: "Europe/Malta",
  timeZoneName: "longOffset",
});

// "GMT+01:00" becomes "+01:00". A zero offset prints as plain "GMT".
const offsetAt = (date: Date) =>
  maltaOffset
    .formatToParts(date)
    .find((part) => part.type === "timeZoneName")
    ?.value.slice(3) || "+00:00";

// On clock-change days the offset at midnight differs from the offset now, so look it up twice.
export const startOfMaltaDay = (now = new Date()) => {
  const midnight = `${maltaDay.format(now)}T00:00:00`;
  return new Date(midnight + offsetAt(new Date(midnight + offsetAt(now))));
};

// Runs outside the checkout transaction, so parallel orders don't all conflict on this one row.
// A checkout that fails after this leaves a gap in the numbers, which is harmless.
export const nextOrderNumber = async (now = new Date()) => {
  const day = maltaDay.format(now).replaceAll("-", "");
  const counter = await OrderCounterModel.findOneAndUpdate(
    { _id: day },
    { $inc: { seq: 1 } },
    { upsert: true, returnDocument: "after" }
  ).lean();
  return `NG-${day}-${String(counter?.seq).padStart(4, "0")}`;
};
