import { UserModel, type UserDocument, type UserRole } from "./user.model.js";

export type PublicUser = {
  id: string;
  username: string;
  email: string;
  role: UserRole;
};

// The only shape of a user that may be sent to a client: passwordHash can't slip through.
export const toPublicUser = (user: UserDocument): PublicUser => ({
  id: user.id,
  username: user.username,
  email: user.email,
  role: user.role,
});

export const findUserById = (id: string) => UserModel.findById(id);

export const findUserByEmailWithPassword = (email: string) =>
  UserModel.findOne({ email }).select("+passwordHash");

export const createUser = (data: { username: string; email: string; passwordHash: string }) =>
  UserModel.create(data);
