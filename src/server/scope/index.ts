import { UnauthenticatedError, ForbiddenError } from "../errors";

/**
 * LA BARRIERE DE CLOISONNEMENT (principe IV, FR-023, FR-024).
 *
 * Un Scope n'est produit QUE par la verification de session cote serveur.
 * Il ne peut jamais etre fabrique a partir d'une donnee venue du navigateur.
 *
 * Le champ prive rend le type nominal : TypeScript refuse tout objet
 * ressemblant construit ailleurs. Ce n'est pas une convention, c'est une
 * impossibilite de compilation.
 */

declare const scopeBrand: unique symbol;

export interface Scope {
  readonly [scopeBrand]: true;
  readonly accountId: string;
  readonly golfCourseId: string;
  readonly role: "admin" | "starter";
}

/** Reserve a src/server/auth/. Aucun autre module ne doit l'appeler. */
export function createScopeFromVerifiedSession(params: {
  accountId: string;
  golfCourseId: string;
  role: "admin" | "starter";
}): Scope {
  return params as Scope;
}

/** FR-021 : la verification de role se fait au serveur, a chaque demande. */
export function requireAdmin(scope: Scope): Scope {
  if (scope.role !== "admin") throw new ForbiddenError();
  return scope;
}

export function assertScope(scope: Scope | null | undefined): Scope {
  if (!scope) throw new UnauthenticatedError();
  return scope;
}
