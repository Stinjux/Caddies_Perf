import { and, count, eq } from "drizzle-orm";
import { db } from "@/db";
import { withCourse } from "@/db/scope-tx";
import { caddie, evaluation, evaluationCriterionAnswer, googleReviewClick } from "@/db/schema";
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
/**
 * PLUS DE LIMITE PAR PARTIE. Le client ne scanne plus une affectation mais un
 * QR de terrain : rien ne permet de savoir combien de parties ont eu lieu, ni
 * de rattacher une reponse a l'une d'elles. La seule barriere restante vit
 * dans le navigateur du client — un temoin par caddie et par jour — et elle
 * est contournable en navigation privee. C'est un choix assume : le seuil de
 * pertinence de cinq evaluations devient le garde-fou statistique.
 */
export const LIMITE_PAR_PARTIE_SUPPRIMEE = true;

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
  caddieId: string;
  langue: Langue;
  /** null signifie « non applicable » : exclu des moyennes, jamais 0. */
  notes: Partial<Record<Critere, number | null>>;
  commentaire?: string | null;
  noteParcours?: number | null;
  perceptionPrix?: PricePerception | null;
}

function noteValide(v: number | null | undefined): boolean {
  return v === null || v === undefined || (Number.isInteger(v) && v >= 1 && v <= 5);
}

/**
 * Nombre d'evaluations deja recues par un caddie. Sert aux rapports, plus a
 * limiter quoi que ce soit.
 *
 * @public-client-path — le client n'a pas de compte, donc pas de portee.
 */
export async function compterEvaluations(
  golfCourseId: string,
  caddieId: string,
): Promise<number> {
  const rows = await withCourse(golfCourseId, (tx) =>
    tx.select({ n: count() }).from(evaluation).where(eq(evaluation.caddieId, caddieId)),
  );
  return Number(rows[0]?.n ?? 0);
}

/** @public-client-path — le client n'a pas de compte, donc pas de portée. */
export async function soumettreEvaluation(s: SoumissionEvaluation): Promise<string> {
  // Le caddie doit exister, appartenir a CE terrain et y etre ACTIF : sans
  // cette verification, n'importe quel identifiant recu du navigateur ferait
  // l'affaire, y compris celui d'un caddie parti ou d'un autre parcours.
  const trouve = await withCourse(s.golfCourseId, (tx) =>
    tx
      .select({ id: caddie.id })
      .from(caddie)
      .where(
        and(
          eq(caddie.id, s.caddieId),
          eq(caddie.golfCourseId, s.golfCourseId),
          eq(caddie.status, "active"),
        ),
      )
      .limit(1),
  );
  if (trouve.length === 0) throw new NotFoundError();

  for (const critere of CRITERES) {
    if (!noteValide(s.notes[critere])) {
      throw new ValidationError(critere, "Chaque note doit être comprise entre 1 et 5 étoiles.");
    }
  }
  if (!noteValide(s.noteParcours)) {
    throw new ValidationError("note", "Chaque note doit être comprise entre 1 et 5 étoiles.");
  }

  const id = uuidv7();
  const maintenant = new Date();
  const commentaire = s.commentaire?.trim();

  await withCourse(s.golfCourseId, async (tx) => {
    await tx.insert(evaluation).values({
      id,
      golfCourseId: s.golfCourseId,
      caddieId: s.caddieId,
      language: s.langue,
      comment: commentaire && commentaire.length > 0 ? commentaire.slice(0, 2000) : null,
      courseRating: s.noteParcours ?? null,
      // Question retiree du questionnaire : la colonne subsiste pour ne pas
      // effacer les reponses deja recueillies, mais plus rien ne l'alimente.
      valueForMoney: null,
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
