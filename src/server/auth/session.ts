import { randomBytes, createHash } from "node:crypto";

/**
 * Sessions maison, stockees en base (research.md §2, approuve le 2026-09-18).
 *
 * Seul le HACHE du jeton est stocke ; le jeton en clair ne vit que dans le
 * cookie HttpOnly. Le statut du compte est reverifie a chaque requete : une
 * session dont le compte est passe a "disabled" est detruite immediatement,
 * sans attendre l'expiration (FR-016) — ce qu'un jeton sans etat ne permet pas.
 */

export const SESSION_COOKIE = "caddieperf_session";

export function createSessionToken(): { token: string; tokenHash: string } {
  const token = randomBytes(32).toString("base64url");
  return { token, tokenHash: hashToken(token) };
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("base64url");
}

export function sessionExpiry(role: "admin" | "starter", now: Date = new Date()): Date {
  const hours =
    role === "admin"
      ? Number(process.env.SESSION_TTL_HOURS_ADMIN ?? 8)
      : Number(process.env.SESSION_TTL_HOURS_STARTER ?? 24);
  return new Date(now.getTime() + hours * 3_600_000);
}

export const sessionCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax",
  path: "/",
} as const;
