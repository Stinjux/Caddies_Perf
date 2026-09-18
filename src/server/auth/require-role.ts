import { ForbiddenError } from "../errors";
import type { Scope } from "../scope";

/**
 * Verification de role cote serveur, a CHAQUE demande (FR-021).
 *
 * Masquer un lien dans la navigation n'est PAS un controle d'acces : ces
 * fonctions sont la seule barriere qui compte.
 */

export function requireRole(scope: Scope, ...allowed: ("admin" | "starter")[]): Scope {
  if (!allowed.includes(scope.role)) throw new ForbiddenError();
  return scope;
}

export const isAdmin = (scope: Scope): boolean => scope.role === "admin";
export const isStarter = (scope: Scope): boolean => scope.role === "starter";
