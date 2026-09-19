import { describe, it, expect, beforeEach, afterAll } from "vitest";
import postgres from "postgres";
import { createCart } from "@/server/services/cart";
import { createCaddie } from "@/server/services/caddie";
import { creerAffectation, terminerAffectation } from "@/server/services/assignment";
import { soumettreEvaluation, type Critere } from "@/server/services/evaluation";
import {
  kpiParCaddie,
  comparerAuParcours,
  distributionNotes,
  kpiTerrain,
  scoreFinal,
  SEUIL_PERTINENCE,
} from "@/server/repositories/kpi";
import { exporterKpiCsv } from "@/server/services/rapports";
import { testDbUrl, resetDb } from "../helpers/reset-db";
import { testScope } from "../helpers/scope";
import { makeCourse, makeAccount } from "../helpers/fixtures";

/** KPI ET RAPPORTS (spéc. 5). */

const sql = postgres(testDbUrl(), { max: 1 });
afterAll(() => sql.end());

let cedres: string;
let atlas: string;
let compteId: string;

beforeEach(async () => {
  await resetDb();
  cedres = await makeCourse("Golf des Cèdres");
  atlas = await makeCourse("Royal Atlas");
  compteId = await makeAccount({
    links: [
      { courseId: cedres, role: "admin" },
      { courseId: atlas, role: "admin" },
    ],
  });
});

const admin = (c = cedres) => testScope({ accountId: compteId, golfCourseId: c, role: "admin" });
const starter = () => testScope({ accountId: compteId, golfCourseId: cedres, role: "starter" });

/** Crée un caddie, lui fait faire n parties terminées, et les fait évaluer. */
async function parcours(
  courseId: string,
  ref: string,
  parties: { notes: Partial<Record<Critere, number | null>>; evaluer?: boolean }[],
) {
  const s = admin(courseId);
  const caddieId = await createCaddie(s, {
    internalRef: ref,
    firstName: "Prenom",
    lastName: "Fictif",
  });

  for (let i = 0; i < parties.length; i++) {
    const cartId = await createCart(s, `${ref}-${i}`);
    const affId = await creerAffectation(s, {
      bookingRef: `${ref}-RES-${i}`,
      teeTime: new Date(),
      cartId,
      caddieId,
    });
    await terminerAffectation(s, affId);

    if (parties[i]!.evaluer !== false) {
      await soumettreEvaluation({ assignmentId: affId, langue: "fr", notes: parties[i]!.notes });
    }
  }
  return caddieId;
}

const notes5 = {
  accueil: 5,
  regles_etiquette: 5,
  connaissance_parcours: 5,
  lecture_verts: 5,
  communication: 5,
  experience_generale: 5,
} as const;
const notes3 = {
  accueil: 3,
  regles_etiquette: 3,
  connaissance_parcours: 3,
  lecture_verts: 3,
  communication: 3,
  experience_generale: 3,
} as const;

describe("formule du score — 70 % compétences, 30 % expérience", () => {
  it("applique la pondération", () => {
    expect(scoreFinal(5, 1)).toBeCloseTo(5 * 0.7 + 1 * 0.3, 5);
    expect(scoreFinal(4, 4)).toBe(4);
  });

  it("retombe sur la mesure disponible quand l'autre manque", () => {
    expect(scoreFinal(null, 3)).toBe(3);
    expect(scoreFinal(4, null)).toBe(4);
    expect(scoreFinal(null, null)).toBeNull();
  });
});

describe("KPI par caddie", () => {
  it("compte jours travaillés, affectations et évaluations", async () => {
    await parcours(cedres, "C-A", [{ notes: notes5 }, { notes: notes5 }]);

    const kpis = await kpiParCaddie(admin());
    const k = kpis.find((x) => x.internalRef === "C-A")!;

    expect(k.joursTravailles).toBe(1); // deux parties le même jour
    expect(k.affectationsTerminees).toBe(2);
    expect(k.evaluations).toBe(2);
    expect(k.tauxReponse).toBe(1);
  });

  it("calcule un taux de réponse partiel", async () => {
    await parcours(cedres, "C-B", [{ notes: notes5 }, { notes: notes5, evaluer: false }]);

    const k = (await kpiParCaddie(admin())).find((x) => x.internalRef === "C-B")!;
    expect(k.evaluations).toBe(1);
    expect(k.tauxReponse).toBe(0.5);
  });

  it("EXCLUT les « non applicable » de la moyenne, sans les compter zéro", async () => {
    await parcours(cedres, "C-C", [{ notes: { ...notes5, lecture_verts: null } }]);

    const k = (await kpiParCaddie(admin())).find((x) => x.internalRef === "C-C")!;
    expect(k.moyenneCompetences).toBe(5);
    expect(k.scoreFinal).toBe(5);
  });

  it("n'attribue aucun score à un caddie sans évaluation", async () => {
    await parcours(cedres, "C-D", [{ notes: notes5, evaluer: false }]);

    const k = (await kpiParCaddie(admin())).find((x) => x.internalRef === "C-D")!;
    expect(k.scoreFinal).toBeNull();
    expect(k.evaluations).toBe(0);
    expect(k.tauxReponse).toBe(0);
  });

  it("conserve les KPI d'un caddie désactivé (FR-042)", async () => {
    const id = await parcours(cedres, "C-E", [{ notes: notes5 }]);
    await sql`UPDATE caddie SET status = 'disabled' WHERE id = ${id}`;

    const k = (await kpiParCaddie(admin())).find((x) => x.internalRef === "C-E")!;
    expect(k.status).toBe("disabled");
    expect(k.scoreFinal).toBe(5);
  });

  it("ne mélange JAMAIS deux terrains (FR-026)", async () => {
    await parcours(cedres, "C-F", [{ notes: notes5 }]);
    await parcours(atlas, "A-F", [{ notes: notes3 }]);

    const refsCedres = (await kpiParCaddie(admin(cedres))).map((k) => k.internalRef);
    expect(refsCedres).toEqual(["C-F"]);

    const refsAtlas = (await kpiParCaddie(admin(atlas))).map((k) => k.internalRef);
    expect(refsAtlas).toEqual(["A-F"]);
  });

  it("interdit les KPI à un Starter (FR-020)", async () => {
    await expect(kpiParCaddie(starter())).rejects.toThrow(/droits/);
  });
});

describe("comparaison à la moyenne du parcours", () => {
  it("donne l'écart, la moyenne et le nombre d'évaluations utilisées", async () => {
    const bon = await parcours(cedres, "C-G", [{ notes: notes5 }]);
    await parcours(cedres, "C-H", [{ notes: notes3 }]);

    const c = await comparerAuParcours(admin(), bon);
    expect(c.scoreCaddie).toBe(5);
    expect(c.moyenneParcours).toBe(4); // (5 + 3) / 2
    expect(c.ecart).toBe(1);
    expect(c.evaluationsUtilisees).toBe(1);
  });

  it("marque la comparaison non significative sous le seuil, SANS la masquer", async () => {
    const id = await parcours(cedres, "C-I", [{ notes: notes5 }]);

    const c = await comparerAuParcours(admin(), id);
    expect(c.significative).toBe(false);
    expect(c.ecart).not.toBeNull();
  });

  it("devient significative au seuil atteint", async () => {
    const parties = Array.from({ length: SEUIL_PERTINENCE }, () => ({ notes: notes5 }));
    const id = await parcours(cedres, "C-J", parties);

    const c = await comparerAuParcours(admin(), id);
    expect(c.evaluationsUtilisees).toBe(SEUIL_PERTINENCE);
    expect(c.significative).toBe(true);
  });

  it("compare au parcours du MÊME terrain seulement", async () => {
    const id = await parcours(cedres, "C-K", [{ notes: notes5 }]);
    await parcours(atlas, "A-K", [{ notes: notes3 }]);

    const c = await comparerAuParcours(admin(cedres), id);
    expect(c.moyenneParcours).toBe(5); // seul caddie des Cèdres
    expect(c.ecart).toBe(0);
  });
});

describe("KPI du terrain — mesures séparées (FR-043)", () => {
  it("agrège la note du parcours et le rapport qualité-prix sans toucher au score du caddie", async () => {
    const caddieId = await createCaddie(admin(), {
      internalRef: "C-L",
      firstName: "P",
      lastName: "F",
    });
    const cartId = await createCart(admin(), "L-1");
    const affId = await creerAffectation(admin(), {
      bookingRef: "L-RES",
      teeTime: new Date(),
      cartId,
      caddieId,
    });
    await terminerAffectation(admin(), affId);
    await soumettreEvaluation({
      assignmentId: affId,
      langue: "fr",
      notes: notes5,
      noteParcours: 2,
      rapportQualitePrix: 1,
      perceptionPrix: "beaucoup_trop_eleve",
    });

    const t = await kpiTerrain(admin());
    expect(t.noteParcours).toBe(2);
    expect(t.rapportQualitePrix).toBe(1);
    expect(t.perceptionPrix.beaucoup_trop_eleve).toBe(1);

    // Le score du caddie reste à 5 : ni la note du parcours ni le prix ne l'affectent.
    const k = (await kpiParCaddie(admin())).find((x) => x.internalRef === "C-L")!;
    expect(k.scoreFinal).toBe(5);
  });
});

describe("distribution des notes", () => {
  it("compte les notes par valeur, en ignorant les « non applicable »", async () => {
    await parcours(cedres, "C-M", [
      { notes: { accueil: 5, communication: 3, lecture_verts: null } },
    ]);

    const d = await distributionNotes(admin());
    expect(d[5]).toBe(1);
    expect(d[3]).toBe(1);
    expect(d[1] + d[2] + d[4]).toBe(0);
  });
});

describe("export CSV", () => {
  it("produit un en-tête sans aucune colonne de donnée personnelle", async () => {
    await parcours(cedres, "C-N", [{ notes: notes5 }]);
    const csv = await exporterKpiCsv(admin());
    const entete = csv.split("\n")[0]!;

    expect(entete).not.toMatch(/naissance|birth|adresse|address|taille|habits/i);
    expect(entete).toContain("identifiant_interne");
    expect(entete).toContain("score_final");
  });

  it("n'exporte que les caddies du terrain actif", async () => {
    await parcours(cedres, "C-O", [{ notes: notes5 }]);
    await parcours(atlas, "A-O", [{ notes: notes3 }]);

    const csv = await exporterKpiCsv(admin(cedres));
    expect(csv).toContain("C-O");
    expect(csv).not.toContain("A-O");
  });

  it("signale les comparaisons non significatives", async () => {
    await parcours(cedres, "C-P", [{ notes: notes5 }]);
    const csv = await exporterKpiCsv(admin());
    expect(csv.split("\n")[1]).toMatch(/;non$/);
  });

  it("interdit l'export à un Starter", async () => {
    await expect(exporterKpiCsv(starter())).rejects.toThrow(/droits/);
  });
});
