// A temporary in-memory MongoDB for one test file. It's deleted when the file finishes.
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";

let mongo: MongoMemoryServer | undefined;

export const startTestDb = async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri("test"));
  // Builds unique indexes, as the real server does at startup.
  await Promise.all(Object.values(mongoose.models).map((model) => model.init()));
};

export const stopTestDb = async () => {
  await mongoose.disconnect();
  await mongo?.stop();
};
