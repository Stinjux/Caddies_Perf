import { createScopeFromVerifiedSession, type Scope } from "@/server/scope";

/**
 * Fabrique une portee pour les tests, en court-circuitant la session.
 * Reserve aux tests : le code applicatif ne peut obtenir une portee que par
 * une session verifiee cote serveur.
 */
export function testScope(params: {
  accountId: string;
  golfCourseId: string;
  role: "admin" | "starter";
  /** Niveau general. Omis, il vaut faux : le defaut est le moindre privilege. */
  generalAdmin?: boolean;
}): Scope {
  return createScopeFromVerifiedSession(params);
}
