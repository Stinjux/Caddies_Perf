/**
 * Nom et options du cookie de session.
 *
 * Module volontairement SANS dependance a node:crypto : il doit rester
 * importable depuis le pre-filtre de routes, qui s'execute en runtime Edge.
 */

export const SESSION_COOKIE = "caddieperf_session";

export const sessionCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax",
  path: "/",
} as const;
