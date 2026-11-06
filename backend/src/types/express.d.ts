import type { PublicUser } from "../modules/users/user.service.js";

declare global {
  namespace Express {
    interface Request {
      user?: PublicUser;
    }
  }
}
