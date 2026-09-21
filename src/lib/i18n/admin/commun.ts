import { adminFr, type TextesAdmin } from "./fr";
import { adminEn } from "./en";

/**
 * LANGUE DE L'INTERFACE D'ADMINISTRATION.
 *
 * Deux langues, toutes deux completes : francais et anglais. A la difference
 * du parcours client — ou une traduction non approuvee serait servie a des
 * joueurs — l'interface d'administration s'adresse au personnel du parcours,
 * et l'anglais y est relu par les memes personnes qui l'utilisent.
 *
 * Ce module ne touche a rien qui soit propre au serveur : la frontiere
 * d'erreur, qui est un composant CLIENT, doit pouvoir en lire les textes.
 * La resolution de la langue par requete vit dans ./index, a cote de
 * next/headers.
 *
 * Le choix se fait dans cet ordre :
 *   1. le temoin de preference, s'il existe (choix explicite) ;
 *   2. l'en-tete Accept-Language du navigateur (choix implicite) ;
 *   3. le francais.
 *
 * Le temoin n'est PAS httpOnly : c'est une preference d'affichage, pas un
 * secret, et la frontiere d'erreur — un composant client — doit pouvoir la
 * lire pour ne pas afficher son message dans la mauvaise langue.
 */

export const LANGUES_ADMIN = ["fr", "en"] as const;
export type LangueAdmin = (typeof LANGUES_ADMIN)[number];

export const COOKIE_LANGUE = "caddieperf_langue";

const DICTIONNAIRES: Record<LangueAdmin, TextesAdmin> = {
  fr: adminFr,
  en: adminEn,
};

export function estLangueAdmin(v: string | undefined | null): v is LangueAdmin {
  return !!v && (LANGUES_ADMIN as readonly string[]).includes(v);
}

export function textesAdmin(langue: LangueAdmin): TextesAdmin {
  return DICTIONNAIRES[langue];
}

/**
 * Premiere langue connue citee par le navigateur.
 *
 * On ne lit que l'etiquette de langue (« en-GB » vaut « en ») et on respecte
 * l'ordre de preference declare : un navigateur reglé sur « ar, en, fr »
 * obtient l'anglais, et non le francais, parce qu'il l'a demande avant.
 */
export function langueDepuisEntete(accept: string | null): LangueAdmin | null {
  if (!accept) return null;
  const demandees = accept
    .split(",")
    .map((morceau) => {
      const [etiquette, ...parametres] = morceau.trim().split(";");
      const q = parametres.find((p) => p.trim().startsWith("q="));
      return {
        langue: (etiquette ?? "").trim().toLowerCase().split("-")[0] ?? "",
        q: q ? Number(q.split("=")[1]) : 1,
      };
    })
    .filter((d) => Number.isFinite(d.q))
    .sort((a, b) => b.q - a.q);

  for (const d of demandees) if (estLangueAdmin(d.langue)) return d.langue;
  return null;
}

/** Le type des dictionnaires, re-exporte pour les composants qui l'annotent. */
export type { TextesAdmin };
