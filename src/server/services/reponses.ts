import { CRITERES, type Critere, type PricePerception } from "./evaluation";

/**
 * TRANSPORT DES RÉPONSES ENTRE DEUX AFFICHAGES (spéc. 4, FR-367 et suivantes).
 *
 * Pourquoi ce module existe : toutes les notes sont obligatoires, mais le
 * questionnaire avance par étapes révélées en CSS. Un attribut `required` sur
 * un champ masqué en `display:none` bloque l'envoi SANS AUCUN MESSAGE — le
 * client appuie, rien ne se passe, il abandonne.
 *
 * L'obligation vit donc côté serveur. Et comme il n'y a aucun JavaScript pour
 * conserver l'état, les réponses déjà données voyagent dans l'adresse et sont
 * réaffichées. Le client ne perd jamais son travail.
 *
 * Encodage volontairement court : quinze caractères environ pour neuf
 * réponses, ce qui tient largement dans une adresse.
 */

export const CHAMPS_NOTES = [...CRITERES, "noteParcours", "rapportQualitePrix"] as const;
export type ChampNote = (typeof CHAMPS_NOTES)[number];

/** Une lettre par champ, dans l'ordre. « n » signifie « non applicable ». */
const CLES: Record<ChampNote, string> = {
  accueil: "a",
  regles_etiquette: "r",
  connaissance_parcours: "p",
  lecture_verts: "v",
  communication: "c",
  experience_generale: "e",
  noteParcours: "t",
  rapportQualitePrix: "q",
};

const PERCEPTIONS: PricePerception[] = [
  "beaucoup_trop_bas",
  "plutot_bas",
  "juste_et_raisonnable",
  "plutot_eleve",
  "beaucoup_trop_eleve",
];

export interface Reponses {
  notes: Partial<Record<ChampNote, number | "na">>;
  perceptionPrix: PricePerception | null;
  commentaire: string;
}

export function lireFormulaire(formData: FormData): Reponses {
  const notes: Reponses["notes"] = {};
  for (const champ of CHAMPS_NOTES) {
    const brut = String(formData.get(champ) ?? "");
    if (brut === "na") notes[champ] = "na";
    else if (/^[1-5]$/.test(brut)) notes[champ] = Number(brut);
  }

  const prix = String(formData.get("perceptionPrix") ?? "");
  return {
    notes,
    perceptionPrix: PERCEPTIONS.includes(prix as PricePerception)
      ? (prix as PricePerception)
      : null,
    commentaire: String(formData.get("commentaire") ?? ""),
  };
}

/** Compacte les réponses pour les faire voyager dans l'adresse. */
export function encoder(r: Reponses): string {
  const parts: string[] = [];
  for (const champ of CHAMPS_NOTES) {
    const v = r.notes[champ];
    if (v !== undefined) parts.push(`${CLES[champ]}${v === "na" ? "n" : v}`);
  }
  if (r.perceptionPrix) parts.push(`x${PERCEPTIONS.indexOf(r.perceptionPrix)}`);
  return parts.join(".");
}

export function decoder(brut: string | undefined): Reponses {
  const notes: Reponses["notes"] = {};
  let perceptionPrix: PricePerception | null = null;
  if (!brut) return { notes, perceptionPrix, commentaire: "" };

  const inverse = Object.fromEntries(
    Object.entries(CLES).map(([champ, cle]) => [cle, champ as ChampNote]),
  );

  for (const part of brut.split(".")) {
    const cle = part[0];
    const valeur = part.slice(1);
    if (cle === "x") {
      const i = Number(valeur);
      if (PERCEPTIONS[i]) perceptionPrix = PERCEPTIONS[i]!;
      continue;
    }
    const champ = cle ? inverse[cle] : undefined;
    if (!champ) continue;
    if (valeur === "n") notes[champ] = "na";
    else if (/^[1-5]$/.test(valeur)) notes[champ] = Number(valeur);
  }

  return { notes, perceptionPrix, commentaire: "" };
}

/**
 * Toutes les notes sont obligatoires ; le commentaire ne l'est jamais.
 * Une réponse « non applicable » COMPTE comme une réponse : elle exprime un
 * jugement, celui que le critère ne s'applique pas.
 */
export function champsManquants(r: Reponses): ChampNote[] {
  return CHAMPS_NOTES.filter((champ) => r.notes[champ] === undefined);
}

export function prixManquant(r: Reponses): boolean {
  return r.perceptionPrix === null;
}

/** Numéro de l'écran (1 à 5) portant le premier champ manquant. */
export function premierEcranIncomplet(r: Reponses): number {
  const manquants = champsManquants(r);
  if (manquants.length > 0) {
    const index = CHAMPS_NOTES.indexOf(manquants[0]!);
    return Math.floor(index / 2) + 1;
  }
  return prixManquant(r) ? 5 : 1;
}

/** Convertit vers la forme attendue par le service d'évaluation. */
export function versSoumission(r: Reponses): {
  notes: Partial<Record<Critere, number | null>>;
  noteParcours: number | null;
  rapportQualitePrix: number | null;
} {
  const conv = (v: number | "na" | undefined): number | null =>
    v === undefined || v === "na" ? null : v;

  const notes: Partial<Record<Critere, number | null>> = {};
  for (const c of CRITERES) notes[c] = conv(r.notes[c]);

  return {
    notes,
    noteParcours: conv(r.notes.noteParcours),
    rapportQualitePrix: conv(r.notes.rapportQualitePrix),
  };
}
