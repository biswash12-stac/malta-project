import { z } from "zod";

const email = z.string().trim().toLowerCase().pipe(z.email());

// The most common passwords that pass the length rule. Attackers try these first.
const COMMON_PASSWORDS = new Set([
  "12345678",
  "123456789",
  "1234567890",
  "87654321",
  "password",
  "password1",
  "password12",
  "password123",
  "passw0rd",
  "pass1234",
  "qwerty123",
  "qwertyuiop",
  "1q2w3e4r",
  "1qaz2wsx",
  "abcd1234",
  "abc12345",
  "admin123",
  "admin1234",
  "administrator",
  "iloveyou",
  "letmein1",
  "welcome1",
  "welcome123",
  "nepal123",
  "kathmandu",
  "malta123",
]);

// Also catches a single repeated character, such as "aaaaaaaa".
const isTooCommon = (password: string) =>
  COMMON_PASSWORDS.has(password.toLowerCase()) || /^(.)\1*$/su.test(password);

export const registerSchema = z.object({
  username: z.string().trim().min(1).max(100),
  email,
  password: z
    .string()
    .min(8)
    // bcrypt ignores everything past 72 bytes, so a longer password would be silently cut.
    .refine((p) => Buffer.byteLength(p) <= 72, "Password is too long")
    .refine((p) => !isTooCommon(p), "This password is too common"),
});

export const loginSchema = z.object({
  email,
  password: z.string().min(1).max(200),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
