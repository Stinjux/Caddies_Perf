import { redirect } from "next/navigation";
import { requireAdmin, type Scope } from "./index";
import { NotFoundError } from "../errors";

/**
 * Gardes d'acces appliques cote serveur, a CHAQUE demande (FR-021).
 *
 * Masquer un element a l'ecran ne tient jamais lieu de controle : ces gardes
 * sont la seule barriere qui compte.
 */

/** Exige le role administrateur, sinon renvoie vers l'espace autorise. */
export function guardAdmin(scope: Scope, fallback = "/parcours"): Scope {
  if (scope.role !== "admin") redirect(fallback);
  return scope;
}

/** Variante levant une erreur, pour les actions serveur et les services. */
export const assertAdmin = requireAdmin;

/**
 * FR-025 : une ressource absente et une ressource d'un autre parcours doivent
 * produire EXACTEMENT la meme reponse. Ce passage obligatoire garantit qu'on
 * ne peut pas, par inadvertance, distinguer les deux.
 */
export function assertFound<T>(value: T | null | undefined): T {
  if (value === null || value === undefined) throw new NotFoundError();
  return value;
}
