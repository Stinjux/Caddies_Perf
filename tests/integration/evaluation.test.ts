import { describe, it, expect, beforeEach } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import {
  evaluation,
  evaluationCriterionAnswer,
  wrongCaddieReport,
  googleReviewClick,
  cart,
} from "@/db/schema";
import { createCart } from "@/server/services/cart";
import { createCaddie } from "@/server/services/caddie";
import { creerAffectation } from "@/server/services/assignment";
import {
  soumettreEvaluation,
  signalerMauvaisCaddie,
  enregistrerClicGoogle,
  compterEvaluations,
  calculerScore,
  MAX_REPONSES_PAR_AFFECTATION,
  CRITERES,
} from "@/server/services/evaluation";
import { resetDb } from "../helpers/reset-db";
import { testScope } from "../helpers/scope";
import { makeCourse, makeAccount } from "../helpers/fixtures";

/** QUESTIONNAIRE CLIENT (spéc. 4). */

let cedres: string;
let compteId: string;
let affectationId: string;

beforeEach(async () => {
  await resetDb();
  cedres = await makeCourse("Golf des Cèdres");
  compteId = await makeAccount({ links: [{ courseId: cedres, role: "admin" }] });
  const v = await createCart(scope(), "12");
  const c = await createCaddie(scope(), {
    internalRef: "C-0001",
    firstName: "Hassan",
    lastName: "Fictif",
  });
  affectationId = await creerAffectation(scope(), {
    bookingRef: "RES-001",
    teeTime: new Date(),
    cartId: v,
    caddieId: c,
  });
  void cart;
});

function scope() {
  return testScope({ accountId: compteId, golfCourseId: cedres, role: "admin" });
}

const notesCompletes = {
  accueil: 5,
  regles_etiquette: 4,
  connaissance_parcours: 5,
  lecture_verts: 3,
  communication: 4,
  experience_generale: 5,
} as const;

describe("soumission d'une évaluation", () => {
  it("enregistre les six critères", async () => {
    const id = await soumettreEvaluation({
      assignmentId: affectationId,
      langue: "fr",
      notes: notesCompletes,
    });

    const reponses = await db
      .select()
      .from(evaluationCriterionAnswer)
      .where(eq(evaluationCriterionAnswer.evaluationId, id));
    expect(reponses).toHaveLength(6);
  });

  it("conserve les trois mesures SÉPARÉMENT (FR-043)", async () => {
    const id = await soumettreEvaluation({
      assignmentId: affectationId,
      langue: "fr",
      notes: notesCompletes,
      noteParcours: 4,
      rapportQualitePrix: 3,
      perceptionPrix: "plutot_eleve",
    });

    const rows = await db.select().from(evaluation).where(eq(evaluation.id, id));
    expect(rows[0]?.courseRating).toBe(4);
    expect(rows[0]?.valueForMoney).toBe(3);
    expect(rows[0]?.pricePerception).toBe("plutot_eleve");
  });

  it("mémorise le tarif affiché au moment de la réponse (FR-048)", async () => {
    const id = await soumettreEvaluation({
      assignmentId: affectationId,
      langue: "fr",
      notes: notesCompletes,
    });
    const rows = await db.select().from(evaluation).where(eq(evaluation.id, id));
    expect(rows[0]?.priceShownMad).toBe(200);
  });

  it("n'enregistre AUCUNE donnée identifiante (FR-032)", async () => {
    const id = await soumettreEvaluation({
      assignmentId: affectationId,
      langue: "fr",
      notes: notesCompletes,
      commentaire: "Commentaire fictif",
    });

    const rows = await db.select().from(evaluation).where(eq(evaluation.id, id));
    expect(Object.keys(rows[0]!).sort()).toEqual([
      "assignmentId",
      "comment",
      "commentPurgeAt",
      "courseRating",
      "golfCourseId",
      "id",
      "language",
      "pricePerception",
      "priceShownMad",
      "submittedAt",
      "valueForMoney",
    ]);
  });

  it("fixe l'échéance de purge du commentaire à deux ans (FR-034c)", async () => {
    const id = await soumettreEvaluation({
      assignmentId: affectationId,
      langue: "fr",
      notes: notesCompletes,
      commentaire: "Commentaire fictif",
    });
    const rows = await db.select().from(evaluation).where(eq(evaluation.id, id));
    const ecart = rows[0]!.commentPurgeAt.getFullYear() - rows[0]!.submittedAt.getFullYear();
    expect(ecart).toBe(2);
  });

  it("accepte une évaluation sans commentaire — il est facultatif", async () => {
    const id = await soumettreEvaluation({
      assignmentId: affectationId,
      langue: "fr",
      notes: notesCompletes,
    });
    const rows = await db.select().from(evaluation).where(eq(evaluation.id, id));
    expect(rows[0]?.comment).toBeNull();
  });

  it("accepte « non applicable » sur un critère", async () => {
    const id = await soumettreEvaluation({
      assignmentId: affectationId,
      langue: "fr",
      notes: { ...notesCompletes, lecture_verts: null },
    });
    const reponses = await db
      .select()
      .from(evaluationCriterionAnswer)
      .where(eq(evaluationCriterionAnswer.evaluationId, id));
    expect(reponses.find((r) => r.criterion === "lecture_verts")?.rating).toBeNull();
  });

  it("refuse une note hors de 1 à 5", async () => {
    await expect(
      soumettreEvaluation({ assignmentId: affectationId, langue: "fr", notes: { accueil: 9 } }),
    ).rejects.toThrow(/1 et 5/);
  });

  it("refuse une affectation inexistante", async () => {
    await expect(
      soumettreEvaluation({
        assignmentId: "00000000-0000-7000-8000-000000000000",
        langue: "fr",
        notes: notesCompletes,
      }),
    ).rejects.toThrow(/introuvable/);
  });
});

describe("FR-051 — quatre réponses au maximum", () => {
  it("accepte quatre évaluations puis refuse la cinquième", async () => {
    for (let i = 0; i < MAX_REPONSES_PAR_AFFECTATION; i++) {
      await soumettreEvaluation({
        assignmentId: affectationId,
        langue: "fr",
        notes: notesCompletes,
      });
    }
    expect(await compterEvaluations(affectationId)).toBe(4);

    await expect(
      soumettreEvaluation({ assignmentId: affectationId, langue: "fr", notes: notesCompletes }),
    ).rejects.toThrow(/nombre maximal/);

    expect(await compterEvaluations(affectationId)).toBe(4);
  });
});

describe("FR-047 — « ce n'est pas mon caddie »", () => {
  it("enregistre le signal, anonymement", async () => {
    await signalerMauvaisCaddie(affectationId);

    const rows = await db.select().from(wrongCaddieReport);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.assignmentId).toBe(affectationId);
    expect(Object.keys(rows[0]!).sort()).toEqual([
      "assignmentId",
      "golfCourseId",
      "id",
      "reportedAt",
    ]);
  });

  it("n'empêche pas une évaluation ultérieure du bon caddie", async () => {
    await signalerMauvaisCaddie(affectationId);
    await expect(
      soumettreEvaluation({ assignmentId: affectationId, langue: "fr", notes: notesCompletes }),
    ).resolves.toMatch(/^[0-9a-f-]{36}$/);
  });
});

describe("clics vers Google Reviews", () => {
  it("mesure le clic, sans prétendre qu'un avis a été publié", async () => {
    const id = await soumettreEvaluation({
      assignmentId: affectationId,
      langue: "fr",
      notes: notesCompletes,
    });
    await enregistrerClicGoogle(cedres, id);

    const rows = await db.select().from(googleReviewClick);
    expect(rows).toHaveLength(1);
    expect(Object.keys(rows[0]!).sort()).toEqual([
      "clickedAt",
      "evaluationId",
      "golfCourseId",
      "id",
    ]);
  });

  it("accepte un clic sans évaluation rattachée", async () => {
    await expect(enregistrerClicGoogle(cedres, null)).resolves.toBeUndefined();
  });
});

describe("calcul du score — 70 % compétences, 30 % expérience générale", () => {
  it("applique la pondération", () => {
    const score = calculerScore({
      accueil: 5,
      regles_etiquette: 5,
      connaissance_parcours: 5,
      lecture_verts: 5,
      communication: 5,
      experience_generale: 1,
    });
    expect(score).toBeCloseTo(5 * 0.7 + 1 * 0.3, 5);
  });

  it("EXCLUT les « non applicable » au lieu de les compter zéro", () => {
    const avec = calculerScore({
      accueil: 4,
      regles_etiquette: 4,
      connaissance_parcours: 4,
      lecture_verts: null,
      communication: 4,
      experience_generale: 4,
    });
    const sans = calculerScore({
      accueil: 4,
      regles_etiquette: 4,
      connaissance_parcours: 4,
      communication: 4,
      experience_generale: 4,
    });

    expect(avec).toBe(4);
    expect(avec).toBe(sans);
  });

  it("ne rend rien quand tout est « non applicable »", () => {
    const vide: Record<string, null> = {};
    for (const c of CRITERES) vide[c] = null;
    expect(calculerScore(vide)).toBeNull();
  });

  it("gère une expérience générale seule", () => {
    expect(calculerScore({ experience_generale: 3 })).toBe(3);
  });

  it("gère des compétences seules, sans expérience générale", () => {
    expect(calculerScore({ accueil: 5, communication: 3 })).toBe(4);
  });

  it("la note du parcours et le prix n'entrent JAMAIS dans le score", () => {
    // calculerScore ne reçoit que les critères : les autres mesures ne
    // peuvent structurellement pas l'influencer.
    expect(calculerScore(notesCompletes)).toBeCloseTo(4.2 * 0.7 + 5 * 0.3, 5);
  });
});
