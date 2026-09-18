import { describe, it, expect, beforeEach } from "vitest";
import { createCourse, updateCourse, archiveCourse } from "@/server/services/golf-course";
import { createAccount, disableAccount, enableAccount } from "@/server/services/account";
import { attachAccount, detachAccount } from "@/server/services/account-course";
import { readBirthYear, writeBirthYear, eraseBirthYear } from "@/server/pii";
import { requireRole, isAdmin, isStarter } from "@/server/auth/require-role";
import { STARTER_ALLOWED_FIELDS, STARTER_FORBIDDEN_FIELDS } from "@/server/serializers/starter";
import { resetDb } from "../../helpers/reset-db";
import { testScope } from "../../helpers/scope";
import { makeCourse, makeAccount, PASSWORD } from "../../helpers/fixtures";

/**
 * T064 — MATRICE COMPLETE DES PERMISSIONS (FR-018, FR-019, FR-020, FR-021).
 *
 * Chaque operation d'administration est eprouvee depuis une portee Starter.
 * Aucune ne doit passer.
 */

let courseId: string;
let compte: string;
let cible: string;

beforeEach(async () => {
  await resetDb();
  courseId = await makeCourse("Golf des Cèdres");
  compte = await makeAccount({ links: [{ courseId, role: "admin" }] });
  cible = await makeAccount({ links: [{ courseId, role: "starter" }] });
});

const starter = () => testScope({ accountId: compte, golfCourseId: courseId, role: "starter" });
const admin = () => testScope({ accountId: compte, golfCourseId: courseId, role: "admin" });

describe("ce qu'un Starter NE PEUT PAS faire (FR-020)", () => {
  const refuse = (nom: string, action: () => Promise<unknown>) =>
    it(`refuse : ${nom}`, async () => {
      await expect(action()).rejects.toThrow(/droits/);
    });

  refuse("modifier un terrain", () =>
    updateCourse(starter(), { name: "X", timezone: "Africa/Casablanca" }, 1),
  );
  refuse("archiver un terrain", () => archiveCourse(starter(), 1));
  refuse("créer un compte", () =>
    createAccount(starter(), {
      email: "x@example.invalid",
      firstName: "P",
      lastName: "F",
      password: PASSWORD,
      role: "starter",
    }),
  );
  refuse("désactiver un compte", () => disableAccount(starter(), cible, 1));
  refuse("réactiver un compte", () => enableAccount(starter(), cible, 1));
  refuse("rattacher un compte", () => attachAccount(starter(), cible, "starter"));
  refuse("détacher un compte", () => detachAccount(starter(), cible));
  refuse("lire une année de naissance", () => readBirthYear(starter(), cible));
  refuse("écrire une année de naissance", () => writeBirthYear(starter(), cible, 1990));
  refuse("effacer des renseignements personnels", () => eraseBirthYear(starter(), cible));
});

describe("ce qu'un administrateur PEUT faire (FR-018)", () => {
  it("modifie et archive un terrain", async () => {
    await expect(
      updateCourse(admin(), { name: "Nouveau", timezone: "Africa/Casablanca" }, 1),
    ).resolves.toBeUndefined();
    await expect(archiveCourse(admin(), 2)).resolves.toBeUndefined();
  });

  it("crée, désactive puis réactive un compte", async () => {
    const id = await createAccount(admin(), {
      email: "nouveau@example.invalid",
      firstName: "P",
      lastName: "F",
      password: PASSWORD,
      role: "starter",
    });
    await expect(disableAccount(admin(), id, 1)).resolves.toBeUndefined();
    await expect(enableAccount(admin(), id, 2)).resolves.toBeUndefined();
  });

  it("crée un terrain sans portée préalable, en s'y rattachant", async () => {
    await expect(
      createCourse(compte, { name: "Autre", timezone: "Africa/Casablanca" }),
    ).resolves.toMatch(/^[0-9a-f-]{36}$/);
  });
});

describe("garde de rôle (FR-021)", () => {
  it("laisse passer le rôle autorisé et refuse les autres", () => {
    expect(() => requireRole(admin(), "admin")).not.toThrow();
    expect(() => requireRole(starter(), "starter")).not.toThrow();
    expect(() => requireRole(starter(), "admin")).toThrow(/droits/);
    expect(() => requireRole(admin(), "starter")).toThrow(/droits/);
  });

  it("accepte plusieurs rôles quand l'écran est partagé", () => {
    expect(() => requireRole(starter(), "starter", "admin")).not.toThrow();
    expect(() => requireRole(admin(), "starter", "admin")).not.toThrow();
  });

  it("identifie correctement le rôle", () => {
    expect(isAdmin(admin())).toBe(true);
    expect(isStarter(admin())).toBe(false);
    expect(isStarter(starter())).toBe(true);
  });
});

describe("projections du Starter : liste blanche, jamais liste noire", () => {
  it("limite chaque vue aux champs autorisés du contrat", () => {
    expect(STARTER_ALLOWED_FIELDS.caddie).toEqual([
      "id",
      "internalRef",
      "firstName",
      "lastName",
      "available",
    ]);
    expect(STARTER_ALLOWED_FIELDS.cart).toEqual(["id", "visibleNumber", "status"]);
    expect(STARTER_ALLOWED_FIELDS.booking).toEqual(["id", "externalRef", "teeTime"]);
  });

  it("ne laisse aucun champ interdit figurer dans une liste autorisée", () => {
    const autorises = Object.values(STARTER_ALLOWED_FIELDS).flat() as string[];
    const chevauchement = STARTER_FORBIDDEN_FIELDS.filter((f) => autorises.includes(f));
    expect(chevauchement).toEqual([]);
  });

  it("interdit explicitement l'année de naissance et le jeton de QR code", () => {
    expect(STARTER_FORBIDDEN_FIELDS).toContain("birthYear");
    expect(STARTER_FORBIDDEN_FIELDS).toContain("qrToken");
    expect(STARTER_FORBIDDEN_FIELDS).toContain("passwordHash");
  });
});
