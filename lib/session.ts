/**
 * Application-level session timeout via a signed activity cookie.
 *
 * Even though Supabase JWTs have their own expiry, this enforces a shorter
 * re-authentication window for sensitive operations (password change, payment).
 *
 * The cookie is HMAC-signed to prevent tampering.
 */
import { cookies } from "next/headers";
import crypto from "crypto";

const COOKIE_NAME = "session_activity";
const SIGNING_KEY = process.env.SESSION_SECRET ?? process.env.NEXTAUTH_SECRET ?? "";
/** How long a session is considered fresh (30 minutes). */
export const SESSION_TIMEOUT_MS = 30 * 60 * 1000;

function sign(value: string): string {
  return crypto.createHmac("sha256", SIGNING_KEY).update(value).digest("hex");
}

/**
 * Set (or refresh) the session activity timestamp.
 * Call after successful sign-in and sensitive re-auth actions.
 */
export async function touchSession() {
  const ts = String(Date.now());
  const sig = sign(ts);
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, `${ts}.${sig}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TIMEOUT_MS / 1000,
  });
}

/**
 * Clear the session activity cookie.
 */
export async function clearSession() {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

/**
 * Check whether the current session is still fresh.
 * Returns `{ fresh: true }` or `{ fresh: false, reason }`.
 */
export async function isSessionFresh(): Promise<
  { fresh: true } | { fresh: false; reason: string }
> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(COOKIE_NAME)?.value;
  if (!raw) {
    return { fresh: false, reason: "No active session. Please sign in again." };
  }

  const dotIndex = raw.lastIndexOf(".");
  if (dotIndex === -1) {
    return { fresh: false, reason: "Invalid session. Please sign in again." };
  }

  const ts = raw.slice(0, dotIndex);
  const sig = raw.slice(dotIndex + 1);

  if (sign(ts) !== sig) {
    return { fresh: false, reason: "Session tampered. Please sign in again." };
  }

  const elapsed = Date.now() - Number(ts);
  if (elapsed > SESSION_TIMEOUT_MS) {
    return {
      fresh: false,
      reason: "Session expired. Please sign in again to continue.",
    };
  }

  return { fresh: true };
}
