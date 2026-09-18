import { describe, it, expect, beforeEach } from "vitest";
import { findCourseInScope, getActiveCourse } from "@/server/repositories/golf-course";
import { findAccountInScope, roleOnCourse } from "@/server/repositories/account";
import { listAuditInScope } from "@/server/repositories/audit";
import { createCourse } from "@/server/services/golf-course";
import { resetDb } from "../../helpers/reset-db";
import { testScope } from "../../helpers/scope";
import { makeCourse, makeAccount } from "../../helpers/fixtures";

/**
 * T053 — LECTURE INTER-TERRAINS REFUSEE (FR-023, FR-025).
 *
 * Un compte rattache au seul terrain A ne doit rien obtenir du terrain B,
 * par aucun chemin de lecture.
 */

let cedres: string;
let atlas: string;
let adminCedres: string;
let adminAtlas: string;

beforeEach(async () => {
  await resetDb();
  cedres = await makeCourse("Golf des Cèdres");
  atlas = await makeCourse("Royal Atlas");
  adminCedres = await makeAccount({ links: [{ courseId: cedres, role: "admin" }] });
  adminAtlas = await makeAccount({ links: [{ courseId: atlas, role: "admin" }] });
});

const scopeCedres = () =>
  testScope({ accountId: adminCedres, golfCourseId: cedres, role: "admin" });

describe("lecture d'un terrain hors portée", () => {
  it("ne remonte rien pour un terrain d'un autre club", async () => {
    expect(await findCourseInScope(scopeCedres(), atlas)).toBeNull();
  });

  it("remonte bien le terrain de la portée", async () => {
    expect(await findCourseInScope(scopeCedres(), cedres)).not.toBeNull();
  });

  it("ne remonte jamais autre chose que le terrain actif", async () => {
    const actif = await getActiveCourse(scopeCedres());
    expect(actif?.id).toBe(cedres);
  });
});

describe("lecture d'un compte hors portée", () => {
  it("ne remonte pas un compte rattaché à un autre terrain", async () => {
    expect(await findAccountInScope(scopeCedres(), adminAtlas)).toBeNull();
  });

  it("remonte un compte du terrain actif", async () => {
    expect(await findAccountInScope(scopeCedres(), adminCedres)).not.toBeNull();
  });

  it("ne reconnaît aucun rôle à un compte sur un terrain non rattaché", async () => {
    expect(await roleOnCourse(adminCedres, atlas)).toBeNull();
    expect(await roleOnCourse(adminCedres, cedres)).toBe("admin");
  });
});

describe("lecture du journal hors portée", () => {
  it("ne laisse voir que les entrées du terrain actif", async () => {
    await createCourse(adminCedres, { name: "A", timezone: "Africa/Casablanca" });
    await createCourse(adminAtlas, { name: "B", timezone: "Africa/Casablanca" });

    const vues = await listAuditInScope(scopeCedres());
    expect(vues.every((e) => e.targetType === "golf_course")).toBe(true);

    // Le journal du terrain actif ne contient aucune trace du terrain voisin.
    const atlasScope = testScope({
      accountId: adminAtlas,
      golfCourseId: atlas,
      role: "admin",
    });
    const vuesAtlas = await listAuditInScope(atlasScope);
    const idsCedres = new Set(vues.map((e) => e.id));
    expect(vuesAtlas.some((e) => idsCedres.has(e.id))).toBe(false);
  });

  it("ne remonte rien sur un terrain sans activité", async () => {
    expect(await listAuditInScope(scopeCedres())).toEqual([]);
  });
});
