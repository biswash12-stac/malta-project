import { UserModel, type UserDocument, type UserRole } from "./user.model.js";

export type PublicUser = {
  id: string;
  username: string;
  email: string;
  role: UserRole;
  twoFactorEnabled: boolean;
};

// The only shape of a user that may be sent to a client: secrets can't slip through.
export const toPublicUser = (user: UserDocument): PublicUser => ({
  id: user.id,
  username: user.username,
  email: user.email,
  role: user.role,
  twoFactorEnabled: user.twoFactorEnabled,
});

export const findUserById = (id: string) => UserModel.findById(id);

// Matches the version too, so an old token can't end sessions that started after it was cancelled.
export const bumpTokenVersion = (id: string, tokenVersion: number) =>
  UserModel.updateOne(
    // Accounts created before tokenVersion existed have no stored value, which reads as 0.
    { _id: id, tokenVersion: tokenVersion === 0 ? { $in: [0, null] } : tokenVersion },
    { $inc: { tokenVersion: 1 } }
  );

export const findUserByEmailWithPassword = (email: string) =>
  UserModel.findOne({ email }).select("+passwordHash");

export const createUser = (data: { username: string; email: string; passwordHash: string }) =>
  UserModel.create(data);
