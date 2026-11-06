import { OAuth2Client } from "google-auth-library";
import { env } from "../../config/env.js";
import { AppError } from "../../utils/app-error.js";
import { UserModel, type UserDocument } from "../users/user.model.js";
import { RefreshSessionModel } from "./refresh-session.model.js";

export const googleClient = new OAuth2Client();

const verifyCredential = async (credential: string) => {
  if (!env.GOOGLE_CLIENT_ID) {
    throw new AppError(503, "GOOGLE_NOT_CONFIGURED", "Google login is not available");
  }
  try {
    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    if (!payload?.sub || !payload.email || !payload.email_verified) throw new Error("Unusable");
    return { googleId: payload.sub, email: payload.email.toLowerCase(), name: payload.name };
  } catch {
    throw AppError.unauthorized("Google login failed");
  }
};

// We don't verify emails at registration, so anyone can sign up with someone else's address and
// set a password. Google has proved this person owns the email, so an unverified account's
// password and sessions may belong to an attacker: remove them. Seeded admins are set up by the
// owner and keep their password.
const linkExistingAccount = async (
  user: UserDocument,
  googleId: string
): Promise<UserDocument | null> => {
  const untrusted = !user.emailVerified && user.role === "customer";
  const linked = await UserModel.findByIdAndUpdate(
    user._id,
    {
      $set: { googleId, emailVerified: true },
      ...(untrusted && {
        $unset: { passwordHash: "", passwordResetToken: "", passwordResetExpires: "" },
        $inc: { tokenVersion: 1 },
      }),
    },
    { returnDocument: "after" }
  );
  if (untrusted) await RefreshSessionModel.deleteMany({ user: user._id });
  return linked;
};

// Returns the user to log in. The caller decides whether 2FA is needed.
export const loginWithGoogle = async (credential: string): Promise<UserDocument> => {
  const { googleId, email, name } = await verifyCredential(credential);

  const byGoogleId = await UserModel.findOne({ googleId });
  if (byGoogleId) return byGoogleId;

  const byEmail = await UserModel.findOne({ email });
  if (byEmail) {
    // This email is already tied to a different Google account.
    if (byEmail.googleId) throw AppError.unauthorized("Google login failed");
    const linked = await linkExistingAccount(byEmail, googleId);
    if (!linked) throw AppError.unauthorized("Google login failed");
    return linked;
  }

  try {
    return await UserModel.create({
      username: (name ?? email.split("@")[0] ?? "Customer").slice(0, 100),
      email,
      googleId,
      emailVerified: true,
    });
  } catch (err) {
    // Rely on the unique indexes, not the lookups above: two parallel sign-ins can't both pass.
    if ((err as { code?: number }).code === 11000) {
      throw AppError.conflict("Please try signing in again");
    }
    throw err;
  }
};
