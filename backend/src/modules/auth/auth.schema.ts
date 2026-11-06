import { z } from "zod";

const email = z.string().trim().toLowerCase().pipe(z.email());

export const registerSchema = z.object({
  username: z.string().trim().min(1).max(100),
  email,
  password: z
    .string()
    .min(8)
    // bcrypt ignores everything past 72 bytes, so a longer password would be silently cut.
    .refine((p) => Buffer.byteLength(p) <= 72, "Password is too long"),
});

export const loginSchema = z.object({
  email,
  password: z.string().min(1).max(200),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
