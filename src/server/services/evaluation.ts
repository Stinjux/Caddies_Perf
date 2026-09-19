import { eq, count } from "drizzle-orm";
import { db } from "@/db";
import { withCourse } from "@/db/scope-tx";
import {
  evaluation,
  evaluationCriterionAnswer,
  googleReviewClick,
  wrongCaddieReport,
  assignment,
} from "@/db/schema";
import { uuidv7 } from "@/lib/uuid";
import { commentPurgeDate } from "../jobs/retention";
import { ValidationError, NotFoundError } from "../errors";
import { TARIF_CADDIE_MAD } from "./qr-resolution";
import type { Langue } from "@/lib/i18n";

/**
 * SOUMISSION D'UNE ÉVALUATION CLIENT (spéc. 4).
 *
 * ANONYME (FR-032) : aucune donnée identifiante n'est enregistrée — ni nom,
 * ni courriel, ni adresse IP, ni empreinte de navigateur. Le client n'a
 * aucun compte, et ces fonctions n'ont donc aucune portée de terrain : le
 * terrain est déduit de l'affectation, côté serveur.
 *
 * TROIS MESURES DISTINCTES (FR-043) : le score du caddie se calcule
 * uniquement à partir des six critères. La note du parcours appartient au
 * terrain. Les réponses sur le prix ne touchent jamais la note du caddie.
 */

export const CRITERES = [
  "accueil",
  "regles_etiquette",
  "connaissance_parcours",
  "lecture_verts",
  "communication",
  "experience_generale",
] as const;
export type Critere = (typeof CRITERES)[number];

/** FR-051 : quatre joueurs au maximum pour une même partie. */
export const MAX_REPONSES_PAR_AFFECTATION = 4;

export type PricePerception =
  | "beaucoup_trop_bas"
  | "plutot_bas"
  | "juste_et_raisonnable"
  | "plutot_eleve"
  | "beaucoup_trop_eleve";

export interface SoumissionEvaluation {
  /** Terrain resolu depuis le jeton. Le client n'a pas de portee ; ce champ
   *  la remplace pour que le RLS sache de quel terrain il s'agit. */
  golfCourseId: string;
  assignmentId: string;
  langue: Langue;
  /** null signifie « non applicable » : exclu des moyennes, jamais 0. */
  notes: Partial<Record<Critere, number | null>>;
  commentaire?: string | null;
  noteParcours?: number | null;
  rapportQualitePrix?: number | null;
  perceptionPrix?: PricePerception | null;
}

function noteValide(v: number | null | undefined): boolean {
  return v === null || v === undefined || (Number.isInteger(v) && v >= 1 && v <= 5);
}

/** @public-client-path — le client n'a pas de compte, donc pas de portée. */
export async function compterEvaluations(
  golfCourseId: string,
  assignmentId: string,
): Promise<number> {
  const rows = await withCourse(golfCourseId, (tx) =>
    tx.select({ n: count() }).from(evaluation).where(eq(evaluation.assignmentId, assignmentId)),
  );
  return Number(rows[0]?.n ?? 0);
}

/** @public-client-path — le client n'a pas de compte, donc pas de portée. */
export async function soumettreEvaluation(s: SoumissionEvaluation): Promise<string> {
  const aff = await withCourse(s.golfCourseId, (tx) =>
    tx
      .select({ id: assignment.id, golfCourseId: assignment.golfCourseId })
      .from(assignment)
      .where(eq(assignment.id, s.assignmentId))
      .limit(1),
  );
  if (aff.length === 0) throw new NotFoundError();

  for (const critere of CRITERES) {
    if (!noteValide(s.notes[critere])) {
      throw new ValidationError(critere, "Chaque note doit être comprise entre 1 et 5 étoiles.");
    }
  }
  if (!noteValide(s.noteParcours) || !noteValide(s.rapportQualitePrix)) {
    throw new ValidationError("note", "Chaque note doit être comprise entre 1 et 5 étoiles.");
  }

  const deja = await compterEvaluations(s.golfCourseId, s.assignmentId);
  if (deja >= MAX_REPONSES_PAR_AFFECTATION) {
    throw new ValidationError(
      "limite",
      "Cette partie a déjà reçu le nombre maximal d'évaluations.",
    );
  }

  const id = uuidv7();
  const maintenant = new Date();
  const commentaire = s.commentaire?.trim();

  await withCourse(s.golfCourseId, async (tx) => {
    await tx.insert(evaluation).values({
      id,
      golfCourseId: aff[0]!.golfCourseId,
      assignmentId: s.assignmentId,
      language: s.langue,
      comment: commentaire && commentaire.length > 0 ? commentaire.slice(0, 2000) : null,
      courseRating: s.noteParcours ?? null,
      valueForMoney: s.rapportQualitePrix ?? null,
      pricePerception: s.perceptionPrix ?? null,
      submittedAt: maintenant,
      commentPurgeAt: commentPurgeDate(maintenant),
      priceShownMad: TARIF_CADDIE_MAD,
    });

    for (const critere of CRITERES) {
      const note = s.notes[critere];
      if (note === undefined) continue;
      await tx.insert(evaluationCriterionAnswer).values({
        evaluationId: id,
        criterion: critere,
        rating: note,
      });
    }
  });

  return id;
}

/**
 * FR-047 : « Non, ce n'est pas mon caddie ». Émis AVANT toute évaluation,
 * il n'a rien à quoi se rattacher sinon l'affectation démentie.
 *
 * @public-client-path — le client n'a pas de compte, donc pas de portée.
 */
export async function signalerMauvaisCaddie(
  golfCourseId: string,
  assignmentId: string,
): Promise<void> {
  await withCourse(golfCourseId, async (tx) => {
    const aff = await tx
      .select({ golfCourseId: assignment.golfCourseId })
      .from(assignment)
      .where(eq(assignment.id, assignmentId))
      .limit(1);
    if (aff.length === 0) throw new NotFoundError();

    await tx.insert(wrongCaddieReport).values({
      id: uuidv7(),
      golfCourseId: aff[0]!.golfCourseId,
      assignmentId,
    });
  });
}

/**
 * Mesure UNIQUEMENT le clic. Ne prétend jamais savoir si un avis a été
 * publié — ce serait une affirmation que rien ne permet de vérifier.
 *
 * @public-client-path — le client n'a pas de compte, donc pas de portée.
 */
export async function enregistrerClicGoogle(
  golfCourseId: string,
  evaluationId: string | null,
): Promise<void> {
  await withCourse(golfCourseId, (tx) =>
    tx.insert(googleReviewClick).values({
      id: uuidv7(),
      golfCourseId,
      evaluationId,
    }),
  );
}

/**
 * SCORE DU CADDIE (règle de la spéc. 5, posée ici car le calcul dépend des
 * réponses) : moyenne des cinq compétences pondérée à 70 %, expérience
 * générale à 30 %. Les « non applicable » sont EXCLUS, jamais comptés zéro.
 */
export function calculerScore(notes: Partial<Record<Critere, number | null>>): number | null {
  const competences = CRITERES.slice(0, 5)
    .map((c) => notes[c])
    .filter((v): v is number => typeof v === "number");

  const general = notes.experience_generale;

  if (competences.length === 0 && typeof general !== "number") return null;

  const moyenneCompetences =
    competences.length > 0 ? competences.reduce((a, b) => a + b, 0) / competences.length : null;

  if (moyenneCompetences === null) return general ?? null;
  if (typeof general !== "number") return moyenneCompetences;

  return moyenneCompetences * 0.7 + general * 0.3;
}
