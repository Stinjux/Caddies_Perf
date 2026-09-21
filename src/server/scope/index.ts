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
  /**
   * Administrateur general : « admin » sur TOUS les parcours.
   *
   * Ce drapeau n'elargit JAMAIS la portee courante. Un administrateur general
   * ne voit qu'un parcours a la fois, exactement comme les autres ; il peut
   * seulement en changer sans rattachement prealable, et atteindre les
   * commandes qui ne visent aucun parcours en particulier (creer un parcours,
   * accorder le niveau general).
   */
  readonly generalAdmin: boolean;
}

/** Reserve a src/server/auth/. Aucun autre module ne doit l'appeler. */
export function createScopeFromVerifiedSession(params: {
  accountId: string;
  golfCourseId: string;
  role: "admin" | "starter";
  generalAdmin?: boolean;
}): Scope {
  // Le defaut est le MOINDRE privilege : un appelant qui oublie ce champ
  // obtient un administrateur ordinaire, jamais un administrateur general.
  // Une omission ne peut donc pas elever les droits par accident.
  return { ...params, generalAdmin: params.generalAdmin === true } as Scope;
}

/** FR-021 : la verification de role se fait au serveur, a chaque demande. */
export function requireAdmin(scope: Scope): Scope {
  if (scope.role !== "admin") throw new ForbiddenError();
  return scope;
}

/**
 * Commandes qui ne visent aucun parcours en particulier : creer un parcours,
 * accorder ou retirer le niveau general. Un administrateur ordinaire, meme
 * irreprochable sur son propre parcours, n'y a pas acces.
 */
export function requireGeneralAdmin(scope: Scope): Scope {
  if (!scope.generalAdmin) throw new ForbiddenError();
  return scope;
}

export function assertScope(scope: Scope | null | undefined): Scope {
  if (!scope) throw new UnauthenticatedError();
  return scope;
}
