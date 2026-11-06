import nodemailer from "nodemailer";
import { env } from "../config/env.js";
import { logger } from "./logger.js";

const transport = env.SMTP_HOST
  ? nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_PORT === 465,
      auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
    })
  : nodemailer.createTransport({ jsonTransport: true });

type Mail = { to: string; subject: string; text: string };

// An object, so tests can replace send() and read what would have gone out.
export const mailer = {
  send: async ({ to, subject, text }: Mail): Promise<void> => {
    await transport.sendMail({ from: env.MAIL_FROM, to, subject, text });
    // Emails contain codes and reset links, so this only ever runs on a developer's machine.
    if (!env.SMTP_HOST && env.isDevelopment) {
      logger.info({ to, subject, text }, "SMTP not configured, email not sent");
    }
  },
};
