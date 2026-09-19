import { sql, eq, and, gte, lte, type SQL } from "drizzle-orm";
import { db } from "@/db";
import {
  assignment,
  evaluation,
  evaluationCriterionAnswer,
  caddie,
  googleReviewClick,
} from "@/db/schema";
import type { Scope } from "../scope";
import { requireAdmin } from "../scope";

/**
 * KPI ET RAPPORTS (spéc. 5).
 *
 * PRINCIPE I — aucune fonction ici ne touche caddie_personal_data. Un
 * rapport ne contient JAMAIS d'année de naissance, d'adresse ni de taille
 * d'habits (FR-030).
 *
 * PRINCIPE IV — tout est filtré par le terrain de la portée (FR-026).
 * Une moyenne ne mélange jamais deux terrains.
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
  joursTravailles: number;
  affectationsTerminees: number;
  evaluations: number;
  tauxReponse: number | null;
  moyenneParCritere: Record<string, number | null>;
  moyenneCompetences: number | null;
  experienceGenerale: number | null;
  scoreFinal: number | null;
}

function bornes(colonne: typeof assignment.localDate, p: Periode): SQL[] {
  const out: SQL[] = [];
  if (p.du) out.push(gte(colonne, p.du.toISOString().slice(0, 10)));
  if (p.au) out.push(lte(colonne, p.au.toISOString().slice(0, 10)));
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

/** KPI de tous les caddies du terrain actif, sur la période demandée. */
export async function kpiParCaddie(scope: Scope, p: Periode = {}): Promise<KpiCaddie[]> {
  requireAdmin(scope);

  const filtreTerrain = eq(assignment.golfCourseId, scope.golfCourseId);
  const periode = bornes(assignment.localDate, p);

  // Jours travaillés et affectations terminées, par caddie.
  const activite = await db
    .select({
      caddieId: assignment.caddieId,
      jours: sql<string>`count(distinct ${assignment.localDate})`,
      terminees: sql<string>`count(*)`,
    })
    .from(assignment)
    .where(and(filtreTerrain, eq(assignment.status, "completed"), ...periode))
    .groupBy(assignment.caddieId);

  // Moyennes par critère, calculées sur les seules réponses renseignées :
  // AVG ignore les valeurs nulles, ce qui applique exactement la règle du
  // « non applicable » exclu.
  const notes = await db
    .select({
      caddieId: assignment.caddieId,
      criterion: evaluationCriterionAnswer.criterion,
      moyenne: sql<string>`avg(${evaluationCriterionAnswer.rating})`,
      n: sql<string>`count(${evaluationCriterionAnswer.rating})`,
    })
    .from(evaluationCriterionAnswer)
    .innerJoin(evaluation, eq(evaluation.id, evaluationCriterionAnswer.evaluationId))
    .innerJoin(assignment, eq(assignment.id, evaluation.assignmentId))
    .where(and(filtreTerrain, ...periode))
    .groupBy(assignment.caddieId, evaluationCriterionAnswer.criterion);

  const nbEvaluations = await db
    .select({ caddieId: assignment.caddieId, n: sql<string>`count(*)` })
    .from(evaluation)
    .innerJoin(assignment, eq(assignment.id, evaluation.assignmentId))
    .where(and(filtreTerrain, ...periode))
    .groupBy(assignment.caddieId);

  const caddies = await db
    .select({
      id: caddie.id,
      internalRef: caddie.internalRef,
      firstName: caddie.firstName,
      lastName: caddie.lastName,
      status: caddie.status,
    })
    .from(caddie)
    .where(eq(caddie.golfCourseId, scope.golfCourseId));

  const parActivite = new Map(activite.map((a) => [a.caddieId, a]));
  const parEval = new Map(nbEvaluations.map((e) => [e.caddieId, Number(e.n)]));

  return caddies.map((c) => {
    const act = parActivite.get(c.id);
    const terminees = Number(act?.terminees ?? 0);
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
      joursTravailles: Number(act?.jours ?? 0),
      affectationsTerminees: terminees,
      evaluations: evals,
      tauxReponse: terminees > 0 ? evals / terminees : null,
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

  const rows = await db
    .select({
      note: evaluationCriterionAnswer.rating,
      n: sql<string>`count(*)`,
    })
    .from(evaluationCriterionAnswer)
    .innerJoin(evaluation, eq(evaluation.id, evaluationCriterionAnswer.evaluationId))
    .innerJoin(assignment, eq(assignment.id, evaluation.assignmentId))
    .where(
      and(
        eq(assignment.golfCourseId, scope.golfCourseId),
        sql`${evaluationCriterionAnswer.rating} is not null`,
        ...bornes(assignment.localDate, p),
      ),
    )
    .groupBy(evaluationCriterionAnswer.rating);

  const out = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  for (const r of rows) {
    if (r.note !== null) out[r.note as 1 | 2 | 3 | 4 | 5] = Number(r.n);
  }
  return out;
}

export interface KpiTerrain {
  noteParcours: number | null;
  rapportQualitePrix: number | null;
  perceptionPrix: Record<string, number>;
  clicsGoogle: number;
  evaluations: number;
}

/** KPI du TERRAIN : note du parcours, valeur perçue, clics Google. */
export async function kpiTerrain(scope: Scope, p: Periode = {}): Promise<KpiTerrain> {
  requireAdmin(scope);

  const periode = bornes(assignment.localDate, p);
  const filtre = and(eq(assignment.golfCourseId, scope.golfCourseId), ...periode);

  const agg = await db
    .select({
      parcours: sql<string>`avg(${evaluation.courseRating})`,
      qualitePrix: sql<string>`avg(${evaluation.valueForMoney})`,
      n: sql<string>`count(*)`,
    })
    .from(evaluation)
    .innerJoin(assignment, eq(assignment.id, evaluation.assignmentId))
    .where(filtre);

  const perception = await db
    .select({ valeur: evaluation.pricePerception, n: sql<string>`count(*)` })
    .from(evaluation)
    .innerJoin(assignment, eq(assignment.id, evaluation.assignmentId))
    .where(and(filtre, sql`${evaluation.pricePerception} is not null`))
    .groupBy(evaluation.pricePerception);

  const clics = await db
    .select({ n: sql<string>`count(*)` })
    .from(googleReviewClick)
    .where(eq(googleReviewClick.golfCourseId, scope.golfCourseId));

  const p0 = agg[0];
  return {
    noteParcours: p0?.parcours ? Number(p0.parcours) : null,
    rapportQualitePrix: p0?.qualitePrix ? Number(p0.qualitePrix) : null,
    perceptionPrix: Object.fromEntries(perception.map((r) => [r.valeur ?? "inconnu", Number(r.n)])),
    clicsGoogle: Number(clics[0]?.n ?? 0),
    evaluations: Number(p0?.n ?? 0),
  };
}
