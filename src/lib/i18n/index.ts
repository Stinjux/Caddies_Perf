/**
 * Internationalisation du parcours client (spéc. 4).
 *
 * CINQ LANGUES prévues : français, anglais, arabe, allemand, espagnol.
 *
 * SEUL LE FRANÇAIS est intégré à ce jour. La constitution exige que chaque
 * traduction soit présentée au propriétaire du produit pour APPROBATION
 * avant intégration : inventer les quatre autres serait une violation.
 *
 * Une langue non encore approuvée retombe sur le français, et l'interface
 * ne la propose pas — mieux vaut ne pas offrir un choix que d'offrir une
 * traduction que personne n'a validée.
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

/** Langues dont la traduction a été APPROUVÉE et intégrée. */
export const LANGUES_DISPONIBLES: Langue[] = ["fr"];

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
