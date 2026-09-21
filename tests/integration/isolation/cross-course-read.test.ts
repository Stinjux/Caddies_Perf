import { describe, it, expect, beforeEach } from "vitest";
import { findCourseInScope, getActiveCourse } from "@/server/repositories/golf-course";
import { findAccountInScope, roleOnCourse } from "@/server/repositories/account";
import { listAuditInScope } from "@/server/repositories/audit";
import { createCourse } from "@/server/services/golf-course";
import { resetDb } from "../../helpers/reset-db";
import { testScope } from "../../helpers/scope";
import { makeCourse, makeAccount } from "../../helpers/fixtures";

/**
 * T053 — LECTURE INTER-PARCOURS REFUSEE (FR-023, FR-025).
 *
 * Un compte rattache au seul parcours A ne doit rien obtenir du parcours B,
 * par aucun chemin de lecture.
 */

let cedres: string;
let atlas: string;
let adminCedres: string;
let adminAtlas: string;
/** Administrateur ORDINAIRE des Cèdres : aucun pouvoir ailleurs. */
let adminSimple: string;

beforeEach(async () => {
  await resetDb();
  cedres = await makeCourse("Golf des Cèdres");
  atlas = await makeCourse("Royal Atlas");
  adminCedres = await makeAccount({
    generalAdmin: true,
    links: [{ courseId: cedres, role: "admin" }],
  });
  adminAtlas = await makeAccount({
    generalAdmin: true,
    links: [{ courseId: atlas, role: "admin" }],
  });
  adminSimple = await makeAccount({ links: [{ courseId: cedres, role: "admin" }] });
});

const scopeCedres = () =>
  testScope({ accountId: adminCedres, golfCourseId: cedres, role: "admin" });

describe("lecture d'un parcours hors portée", () => {
  it("ne remonte rien pour un parcours d'un autre club", async () => {
    expect(await findCourseInScope(scopeCedres(), atlas)).toBeNull();
  });

  it("remonte bien le parcours de la portée", async () => {
    expect(await findCourseInScope(scopeCedres(), cedres)).not.toBeNull();
  });

  it("ne remonte jamais autre chose que le parcours actif", async () => {
    const actif = await getActiveCourse(scopeCedres());
    expect(actif?.id).toBe(cedres);
  });
});

describe("lecture d'un compte hors portée", () => {
  it("ne remonte pas un compte rattaché à un autre parcours", async () => {
    expect(await findAccountInScope(scopeCedres(), adminAtlas)).toBeNull();
  });

  it("remonte un compte du parcours actif", async () => {
    expect(await findAccountInScope(scopeCedres(), adminCedres)).not.toBeNull();
  });

  it("ne reconnaît aucun rôle à un compte sur un parcours non rattaché", async () => {
    expect(await roleOnCourse(adminSimple, atlas)).toBeNull();
    expect(await roleOnCourse(adminSimple, cedres)).toBe("admin");
  });

  /**
   * LE REVERS EXACT DU TEST PRÉCÉDENT.
   *
   * L'administrateur général est « admin » sur un parcours auquel rien ne le
   * rattache — c'est précisément ce qui le distingue. Sans ce test, la
   * différence entre les deux niveaux ne serait affirmée nulle part, et un
   * durcissement du cloisonnement pourrait l'effacer en silence.
   */
  it("reconnaît le rôle admin à un administrateur général partout", async () => {
    expect(await roleOnCourse(adminCedres, atlas)).toBe("admin");
    expect(await roleOnCourse(adminCedres, cedres)).toBe("admin");
  });

  /** Mais seulement sur un parcours qui existe : pas de portée fantôme. */
  it("ne reconnaît aucun rôle à un administrateur général sur un parcours inexistant", async () => {
    expect(await roleOnCourse(adminCedres, "00000000-0000-7000-8000-000000000000")).toBeNull();
  });
});

describe("lecture du journal hors portée", () => {
  it("ne laisse voir que les entrées du parcours actif", async () => {
    await createCourse(adminCedres, { name: "A", timezone: "Africa/Casablanca" });
    await createCourse(adminAtlas, { name: "B", timezone: "Africa/Casablanca" });

    const vues = await listAuditInScope(scopeCedres());
    expect(vues.every((e) => e.targetType === "golf_course")).toBe(true);

    // Le journal du parcours actif ne contient aucune trace du parcours voisin.
    const atlasScope = testScope({
      accountId: adminAtlas,
      golfCourseId: atlas,
      role: "admin",
    });
    const vuesAtlas = await listAuditInScope(atlasScope);
    const idsCedres = new Set(vues.map((e) => e.id));
    expect(vuesAtlas.some((e) => idsCedres.has(e.id))).toBe(false);
  });

  it("ne remonte rien sur un parcours sans activité", async () => {
    expect(await listAuditInScope(scopeCedres())).toEqual([]);
  });
});
