import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { ApiError } from "./http";

/**
 * The admin area is guarded by one password (`ADMIN_PASSWORD`). Signing in
 * sets an httpOnly cookie derived from it, so changing the password signs
 * everyone out and there is no session table to keep.
 */

const COOKIE = "debait_admin";
const MAX_AGE = 60 * 60 * 24 * 7;
const DEV_PASSWORD = "admin";

/** True when no password is configured and the development fallback is in use. */
export function usingDevPassword(): boolean {
  return !process.env.ADMIN_PASSWORD && process.env.NODE_ENV !== "production";
}

function password(): string | null {
  if (process.env.ADMIN_PASSWORD) return process.env.ADMIN_PASSWORD;
  return usingDevPassword() ? DEV_PASSWORD : null;
}

const digest = (value: string) => createHash("sha256").update(value).digest();
const sessionValue = (secret: string) => createHmac("sha256", digest(secret)).update("debait-admin-session:v1").digest("hex");

function sameText(left: string, right: string): boolean {
  // Hash both sides so the comparison is constant-time whatever their lengths.
  return timingSafeEqual(digest(left), digest(right));
}

export function checkPassword(input: string): boolean {
  const expected = password();
  return expected !== null && sameText(input, expected);
}

export async function isAdmin(): Promise<boolean> {
  const expected = password();
  if (expected === null) return false;
  const cookie = (await cookies()).get(COOKIE)?.value;
  return cookie !== undefined && sameText(cookie, sessionValue(expected));
}

export async function requireAdmin(): Promise<void> {
  if (!(await isAdmin())) throw new ApiError("unauthorized");
}

export async function startSession(): Promise<void> {
  const expected = password();
  if (expected === null) throw new ApiError("unauthorized");
  (await cookies()).set(COOKIE, sessionValue(expected), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export async function endSession(): Promise<void> {
  (await cookies()).delete(COOKIE);
}
