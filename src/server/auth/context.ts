import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { resolveSession, type SessionContext } from "./current";
import { SESSION_COOKIE } from "./session";
import type { Scope } from "../scope";

/**
 * Acces a la session depuis un composant ou une action serveur.
 * Seule voie par laquelle une portee entre dans l'application (FR-024).
 */

export async function currentSession(): Promise<SessionContext | null> {
  const store = await cookies();
  return resolveSession(store.get(SESSION_COOKIE)?.value);
}

/** Exige une session ET un terrain actif. Redirige sinon. */
export async function requireScope(): Promise<{ ctx: SessionContext; scope: Scope }> {
  const ctx = await currentSession();
  if (!ctx) redirect("/connexion");
  if (!ctx.scope) redirect("/choisir-terrain");
  return { ctx, scope: ctx.scope };
}
