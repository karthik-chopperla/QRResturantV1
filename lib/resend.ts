import { Resend } from "resend";

// Intentionally do not fall back to a placeholder key — if the env var is
// missing, leave `resend` as null so callers can gate on it explicitly.
export const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;
