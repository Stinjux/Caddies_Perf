import { sql, eq, and, gte, lte, type SQL } from "drizzle-orm";
import { withScope } from "@/db/scope-tx";
import { caddie, evaluation, evaluationCriterionAnswer, googleReviewClick } from "@/db/schema";
import type { Scope } from "../scope";
import { requireAdmin } from "../scope";

/**
 * KPI ET RAPPORTS (spéc. 5).
 *
 * PRINCIPE I — aucune fonction ici ne touche caddie_personal_data. Un
 * rapport ne contient JAMAIS d'année de naissance, d'adresse ni de taille
 * d'habits (FR-030).
 *
 * PRINCIPE IV — tout est filtré par le parcours de la portée (FR-026).
 * Une moyenne ne mélange jamais deux parcours.
 */

/** Seuil en deçà duquel une comparaison n'est pas statistiquement parlante. */
export const SEUIL_PERTINENCE = 5;

export const COMPETENCES = [
  "accueil",
  "regles_etiquette",
  "connaissance_parcours",
  "lecture_verts",
  "communication",
] as const;

export interface Periode {
  du?: Date;
  au?: Date;
}

export interface KpiCaddie {
  caddieId: string;
  internalRef: string;
  firstName: string;
  lastName: string;
  status: "active" | "disabled";
  /**
   * JOURS TRAVAILLES ET TAUX DE REPONSE ONT DISPARU, et ne peuvent pas
   * revenir : plus personne n'enregistre qu'un caddie a travaille. Sans
   * denominateur, un taux serait une invention. Le nombre d'evaluations
   * reste, et le seuil de pertinence dit s'il suffit.
   */
  evaluations: number;
  moyenneParCritere: Record<string, number | null>;
  moyenneCompetences: number | null;
  experienceGenerale: number | null;
  scoreFinal: number | null;
}

/**
 * La periode porte sur la date de SOUMISSION de l'evaluation. Il n'existe
 * plus de date de partie : le client scanne le QR du parcours, pas une
 * affectation datee.
 */
function bornes(p: Periode): SQL[] {
  const out: SQL[] = [];
  if (p.du) out.push(gte(evaluation.submittedAt, p.du));
  if (p.au) out.push(lte(evaluation.submittedAt, p.au));
  return out;
}

/**
 * Score final = (moyenne des cinq compétences × 0,70) + (expérience × 0,30).
 * Les « non applicable » sont EXCLUS, jamais comptés zéro.
 */
export function scoreFinal(
  moyenneCompetences: number | null,
  experienceGenerale: number | null,
): number | null {
  if (moyenneCompetences === null && experienceGenerale === null) return null;
  if (moyenneCompetences === null) return experienceGenerale;
  if (experienceGenerale === null) return moyenneCompetences;
  return moyenneCompetences * 0.7 + experienceGenerale * 0.3;
}

/** KPI de tous les caddies du parcours actif, sur la période demandée. */
export async function kpiParCaddie(scope: Scope, p: Periode = {}): Promise<KpiCaddie[]> {
  requireAdmin(scope);

  const filtreParcours = eq(evaluation.golfCourseId, scope.golfCourseId);
  const periode = bornes(p);

  // Moyennes par critère, calculées sur les seules réponses renseignées :
  // AVG ignore les valeurs nulles, ce qui applique exactement la règle du
  // « non applicable » exclu.
  const notes = await withScope(scope, (tx) =>
    tx
      .select({
        caddieId: evaluation.caddieId,
        criterion: evaluationCriterionAnswer.criterion,
        moyenne: sql<string>`avg(${evaluationCriterionAnswer.rating})`,
        n: sql<string>`count(${evaluationCriterionAnswer.rating})`,
      })
      .from(evaluationCriterionAnswer)
      .innerJoin(evaluation, eq(evaluation.id, evaluationCriterionAnswer.evaluationId))
      .where(and(filtreParcours, ...periode))
      .groupBy(evaluation.caddieId, evaluationCriterionAnswer.criterion),
  );

  const nbEvaluations = await withScope(scope, (tx) =>
    tx
      .select({ caddieId: evaluation.caddieId, n: sql<string>`count(*)` })
      .from(evaluation)
      .where(and(filtreParcours, ...periode))
      .groupBy(evaluation.caddieId),
  );

  const caddies = await withScope(scope, (tx) =>
    tx
      .select({
        id: caddie.id,
        internalRef: caddie.internalRef,
        firstName: caddie.firstName,
        lastName: caddie.lastName,
        status: caddie.status,
      })
      .from(caddie)
      .where(eq(caddie.golfCourseId, scope.golfCourseId)),
  );

  const parEval = new Map(nbEvaluations.map((e) => [e.caddieId, Number(e.n)]));

  return caddies.map((c) => {
    const evals = parEval.get(c.id) ?? 0;

    const moyennes: Record<string, number | null> = {};
    for (const n of notes.filter((n) => n.caddieId === c.id)) {
      moyennes[n.criterion] = n.moyenne === null ? null : Number(n.moyenne);
    }

    const competences = COMPETENCES.map((k) => moyennes[k]).filter(
      (v): v is number => typeof v === "number",
    );
    const moyenneCompetences =
      competences.length > 0 ? competences.reduce((a, b) => a + b, 0) / competences.length : null;
    const experience = moyennes.experience_generale ?? null;

    return {
      caddieId: c.id,
      internalRef: c.internalRef,
      firstName: c.firstName,
      lastName: c.lastName,
      status: c.status,
      evaluations: evals,
      moyenneParCritere: moyennes,
      moyenneCompetences,
      experienceGenerale: experience,
      scoreFinal: scoreFinal(moyenneCompetences, experience),
    };
  });
}

export interface Comparaison {
  scoreCaddie: number | null;
  moyenneParcours: number | null;
  ecart: number | null;
  evaluationsUtilisees: number;
  significative: boolean;
}

/**
 * Comparaison d'un caddie à la moyenne de SON parcours, sur la MÊME période
 * et les MÊMES critères (FR-026).
 *
 * En deçà du seuil, la comparaison est affichée mais marquée non
 * significative — jamais masquée. Masquer une donnée que l'administrateur
 * peut déduire ailleurs serait trompeur.
 */
export async function comparerAuParcours(
  scope: Scope,
  caddieId: string,
  p: Periode = {},
): Promise<Comparaison> {
  requireAdmin(scope);

  const tous = await kpiParCaddie(scope, p);
  const lui = tous.find((k) => k.caddieId === caddieId);

  const scores = tous.map((k) => k.scoreFinal).filter((v): v is number => typeof v === "number");
  const moyenneParcours =
    scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : null;

  const scoreCaddie = lui?.scoreFinal ?? null;
  const utilisees = lui?.evaluations ?? 0;

  return {
    scoreCaddie,
    moyenneParcours,
    ecart: scoreCaddie !== null && moyenneParcours !== null ? scoreCaddie - moyenneParcours : null,
    evaluationsUtilisees: utilisees,
    significative: utilisees >= SEUIL_PERTINENCE,
  };
}

/** Distribution des notes de 1 à 5, tous critères confondus. */
export async function distributionNotes(
  scope: Scope,
  p: Periode = {},
): Promise<Record<1 | 2 | 3 | 4 | 5, number>> {
  requireAdmin(scope);

  const rows = await withScope(scope, (tx) =>
    tx
      .select({
        note: evaluationCriterionAnswer.rating,
        n: sql<string>`count(*)`,
      })
      .from(evaluationCriterionAnswer)
      .innerJoin(evaluation, eq(evaluation.id, evaluationCriterionAnswer.evaluationId))
      .where(
        and(
          eq(evaluation.golfCourseId, scope.golfCourseId),
          sql`${evaluationCriterionAnswer.rating} is not null`,
          ...bornes(p),
        ),
      )
      .groupBy(evaluationCriterionAnswer.rating),
  );

  const out = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  for (const r of rows) {
    if (r.note !== null) out[r.note as 1 | 2 | 3 | 4 | 5] = Number(r.n);
  }
  return out;
}

export interface KpiParcours {
  noteParcours: number | null;
  perceptionPrix: Record<string, number>;
  clicsGoogle: number;
  evaluations: number;
}

/** KPI du PARCOURS : note du parcours, valeur perçue, clics Google. */
export async function kpiParcours(scope: Scope, p: Periode = {}): Promise<KpiParcours> {
  requireAdmin(scope);

  const periode = bornes(p);
  const filtre = and(eq(evaluation.golfCourseId, scope.golfCourseId), ...periode);

  const agg = await withScope(scope, (tx) =>
    tx
      .select({
        parcours: sql<string>`avg(${evaluation.courseRating})`,
        n: sql<string>`count(*)`,
      })
      .from(evaluation)
      .where(filtre),
  );

  const perception = await withScope(scope, (tx) =>
    tx
      .select({ valeur: evaluation.pricePerception, n: sql<string>`count(*)` })
      .from(evaluation)
      .where(and(filtre, sql`${evaluation.pricePerception} is not null`))
      .groupBy(evaluation.pricePerception),
  );

  const clics = await withScope(scope, (tx) =>
    tx
      .select({ n: sql<string>`count(*)` })
      .from(googleReviewClick)
      .where(eq(googleReviewClick.golfCourseId, scope.golfCourseId)),
  );

  const p0 = agg[0];
  return {
    noteParcours: p0?.parcours ? Number(p0.parcours) : null,
    perceptionPrix: Object.fromEntries(perception.map((r) => [r.valeur ?? "inconnu", Number(r.n)])),
    clicsGoogle: Number(clics[0]?.n ?? 0),
    evaluations: Number(p0?.n ?? 0),
  };
}
