import { fr, type Messages } from "./fr";
import { en } from "./en";
import { ar } from "./ar";
import { de } from "./de";
import { es } from "./es";

/**
 * Internationalisation du parcours client (spéc. 4).
 *
 * CINQ LANGUES, toutes intégrées : français, anglais, arabe, allemand,
 * espagnol. Le français reste la langue de référence — c'est lui qui donne
 * sa FORME aux quatre autres, et une traduction incomplète ne compile pas.
 *
 * Chacune a été présentée au propriétaire du produit et approuvée avant
 * intégration, comme l'exige la constitution.
 */

export const LANGUES = ["fr", "en", "ar", "de", "es"] as const;
export type Langue = (typeof LANGUES)[number];

/** L'arabe s'écrit de droite à gauche. */
export const RTL: ReadonlySet<Langue> = new Set<Langue>(["ar"]);

export const NOMS_LANGUES: Record<Langue, string> = {
  fr: "Français",
  en: "English",
  ar: "العربية",
  de: "Deutsch",
  es: "Español",
};

const DICTIONNAIRES: Record<Langue, Messages> = { fr, en, ar, de, es };

/**
 * Langues dont la traduction a été APPROUVÉE et intégrée.
 *
 * Dérivée du dictionnaire, non recopiée : ajouter une langue à `LANGUES` sans
 * lui écrire de traduction ne compilerait pas, et l'écran d'accueil ne peut
 * donc jamais proposer un drapeau qui mène au français.
 */
export const LANGUES_DISPONIBLES: Langue[] = [...LANGUES];

export function estLangue(v: string | undefined): v is Langue {
  return !!v && (LANGUES as readonly string[]).includes(v);
}

export function direction(langue: Langue): "rtl" | "ltr" {
  return RTL.has(langue) ? "rtl" : "ltr";
}

export function resoudreLangue(demandee: string | undefined): Langue {
  if (estLangue(demandee) && LANGUES_DISPONIBLES.includes(demandee)) return demandee;
  return "fr";
}

/** Les textes de la langue demandée. */
export function messages(langue: Langue): Messages {
  return DICTIONNAIRES[langue];
}

export type { Messages };
