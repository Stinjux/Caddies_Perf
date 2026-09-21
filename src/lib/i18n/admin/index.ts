import { cookies, headers } from "next/headers";
import { COOKIE_LANGUE, estLangueAdmin, langueDepuisEntete, textesAdmin } from "./commun";
import type { LangueAdmin, TextesAdmin } from "./commun";

/**
 * Resolution de la langue d'administration POUR LA REQUETE EN COURS.
 *
 * Ce module touche a next/headers : il ne peut vivre que cote serveur. Tout
 * ce qui est utilisable des deux cotes — constantes, dictionnaires, choix
 * d'une langue a partir d'une chaine — est dans ./commun, que la frontiere
 * d'erreur importe sans entrainer le serveur avec elle.
 */

export * from "./commun";

/** Langue effective de la requete en cours. Utilisable dans tout composant serveur. */
export async function langueAdmin(): Promise<LangueAdmin> {
  const choisie = (await cookies()).get(COOKIE_LANGUE)?.value;
  if (estLangueAdmin(choisie)) return choisie;
  return langueDepuisEntete((await headers()).get("accept-language")) ?? "fr";
}

/** Raccourci : la langue ET ses textes, en une seule attente. */
export async function tAdmin(): Promise<{ langue: LangueAdmin; t: TextesAdmin }> {
  const langue = await langueAdmin();
  return { langue, t: textesAdmin(langue) };
}
