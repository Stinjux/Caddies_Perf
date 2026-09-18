import { describe, it, expect, beforeEach } from "vitest";
import { listAccountsInScope, listLinksForAccount } from "@/server/repositories/account";
import { listCoursesForAccount } from "@/server/repositories/golf-course";
import { listAuditInScope } from "@/server/repositories/audit";
import { createCourse } from "@/server/services/golf-course";
import { createAccount } from "@/server/services/account";
import { resetDb } from "../../helpers/reset-db";
import { testScope } from "../../helpers/scope";
import { makeCourse, makeAccount, PASSWORD } from "../../helpers/fixtures";

/**
 * T055 — AUCUNE LISTE NE LAISSE FUIR UN ELEMENT VOISIN (FR-023, FR-026).
 *
 * Une fuite par liste est la plus insidieuse : elle ne demande aucune
 * manipulation d'identifiant, elle s'affiche d'elle-meme.
 */

let cedres: string;
let atlas: string;
let adminCedres: string;
let adminAtlas: string;

beforeEach(async () => {
  await resetDb();
  cedres = await makeCourse("Golf des Cèdres");
  atlas = await makeCourse("Royal Atlas");
  adminCedres = await makeAccount({
    email: "cedres@example.invalid",
    links: [{ courseId: cedres, role: "admin" }],
  });
  adminAtlas = await makeAccount({
    email: "atlas@example.invalid",
    links: [{ courseId: atlas, role: "admin" }],
  });
});

const scopeCedres = () =>
  testScope({ accountId: adminCedres, golfCourseId: cedres, role: "admin" });

describe("liste des comptes", () => {
  it("n'affiche aucun compte rattaché au seul terrain voisin", async () => {
    const liste = await listAccountsInScope(scopeCedres());
    expect(liste.map((a) => a.email)).toEqual(["cedres@example.invalid"]);
  });

  it("reste cloisonnée même après ajout de comptes des deux côtés", async () => {
    const scopeAtlas = testScope({ accountId: adminAtlas, golfCourseId: atlas, role: "admin" });

    await createAccount(scopeCedres(), {
      email: "c1@example.invalid",
      firstName: "P",
      lastName: "F",
      password: PASSWORD,
      role: "starter",
    });
    await createAccount(scopeAtlas, {
      email: "a1@example.invalid",
      firstName: "P",
      lastName: "F",
      password: PASSWORD,
      role: "starter",
    });

    const vueCedres = await listAccountsInScope(scopeCedres());
    const vueAtlas = await listAccountsInScope(scopeAtlas);

    expect(vueCedres.map((a) => a.email).sort()).toEqual([
      "c1@example.invalid",
      "cedres@example.invalid",
    ]);
    expect(vueAtlas.map((a) => a.email).sort()).toEqual([
      "a1@example.invalid",
      "atlas@example.invalid",
    ]);
  });

  it("ne renvoie aucun haché de mot de passe dans la liste", async () => {
    const liste = await listAccountsInScope(scopeCedres());
    const serialise = JSON.stringify(liste);
    expect(serialise).not.toContain("scrypt$");
    expect(serialise).not.toContain("passwordHash");
  });
});

describe("liste des terrains", () => {
  it("ne liste que les terrains rattachés au compte", async () => {
    const mine = await listCoursesForAccount(adminCedres);
    expect(mine.map((c) => c.name)).toEqual(["Golf des Cèdres"]);
  });

  it("liste les deux terrains d'un compte doublement rattaché, et rien de plus", async () => {
    const double = await makeAccount({
      links: [
        { courseId: cedres, role: "admin" },
        { courseId: atlas, role: "starter" },
      ],
    });
    await makeCourse("Terrain Tiers");

    const links = await listLinksForAccount(double);
    expect(links.map((l) => l.name).sort()).toEqual(["Golf des Cèdres", "Royal Atlas"]);
  });
});

describe("liste du journal", () => {
  it("ne mélange jamais les entrées de deux terrains", async () => {
    await createCourse(adminCedres, { name: "Nouveau Cèdres", timezone: "Africa/Casablanca" });
    await createCourse(adminAtlas, { name: "Nouvel Atlas", timezone: "Africa/Casablanca" });

    const vue = await listAuditInScope(scopeCedres());
    expect(vue).toEqual([]);
  });

  it("n'expose aucune valeur métier dans les entrées (FR-037)", async () => {
    await createAccount(scopeCedres(), {
      email: "trace@example.invalid",
      firstName: "Prenom",
      lastName: "Fictif",
      password: PASSWORD,
      role: "starter",
    });

    const vue = await listAuditInScope(scopeCedres());
    const serialise = JSON.stringify(vue);
    expect(serialise).not.toContain("trace@example.invalid");
    expect(serialise).not.toContain(PASSWORD);
  });
});
