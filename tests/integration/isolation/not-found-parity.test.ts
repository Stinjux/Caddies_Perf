import { describe, it, expect, beforeEach } from "vitest";
import { findCourseInScope } from "@/server/repositories/golf-course";
import { findAccountInScope } from "@/server/repositories/account";
import { disableAccount } from "@/server/services/account";
import { detachAccount } from "@/server/services/account-course";
import { resetDb } from "../../helpers/reset-db";
import { testScope } from "../../helpers/scope";
import { makeCourse, makeAccount } from "../../helpers/fixtures";
import { uuidv7 } from "@/lib/uuid";

/**
 * T057 — PARITE DES REPONSES (FR-025).
 *
 * Une ressource INEXISTANTE et une ressource D'UN AUTRE PARCOURS doivent
 * produire EXACTEMENT la meme reponse. Toute difference — message, type
 * d'erreur, voire duree — revelerait l'existence de donnees voisines.
 */

let cedres: string;
let atlas: string;
let adminCedres: string;
let compteVoisin: string;

beforeEach(async () => {
  await resetDb();
  cedres = await makeCourse("Golf des Cèdres");
  atlas = await makeCourse("Royal Atlas");
  adminCedres = await makeAccount({ links: [{ courseId: cedres, role: "admin" }] });
  compteVoisin = await makeAccount({ links: [{ courseId: atlas, role: "admin" }] });
});

const scope = () => testScope({ accountId: adminCedres, golfCourseId: cedres, role: "admin" });

const INEXISTANT = uuidv7();

describe("lectures : même réponse dans les deux cas", () => {
  it("parcours inexistant et parcours voisin donnent tous deux null", async () => {
    const inexistant = await findCourseInScope(scope(), INEXISTANT);
    const voisin = await findCourseInScope(scope(), atlas);
    expect(inexistant).toBe(voisin);
    expect(voisin).toBeNull();
  });

  it("compte inexistant et compte voisin donnent tous deux null", async () => {
    const inexistant = await findAccountInScope(scope(), INEXISTANT);
    const voisin = await findAccountInScope(scope(), compteVoisin);
    expect(inexistant).toBe(voisin);
    expect(voisin).toBeNull();
  });
});

describe("écritures : même erreur dans les deux cas", () => {
  it("désactivation : message identique pour l'inexistant et le voisin", async () => {
    const a = await disableAccount(scope(), INEXISTANT, 1).catch((e) => ({
      name: e.name,
      code: e.code,
      message: e.message,
    }));
    const b = await disableAccount(scope(), compteVoisin, 1).catch((e) => ({
      name: e.name,
      code: e.code,
      message: e.message,
    }));

    expect(a).toEqual(b);
    expect(a).toMatchObject({ name: "NotFoundError", code: "not_found" });
  });

  it("détachement : message identique pour l'inexistant et le voisin", async () => {
    const a = await detachAccount(scope(), INEXISTANT).catch((e) => e.message);
    const b = await detachAccount(scope(), compteVoisin).catch((e) => e.message);
    expect(a).toBe(b);
  });
});

describe("le message de refus ne révèle rien", () => {
  it("ne cite ni identifiant, ni nom, ni parcours", async () => {
    const message = await disableAccount(scope(), compteVoisin, 1).catch((e) => e.message);

    expect(message).toBe("Ressource introuvable.");
    expect(message).not.toContain(compteVoisin);
    expect(message).not.toContain(atlas);
    expect(message).not.toContain("Royal Atlas");
  });

  it("porte un identifiant de corrélation différent à chaque occurrence", async () => {
    const a = await disableAccount(scope(), compteVoisin, 1).catch((e) => e.correlationId);
    const b = await disableAccount(scope(), compteVoisin, 1).catch((e) => e.correlationId);

    expect(a).toBeTruthy();
    expect(a).not.toBe(b);
  });
});
