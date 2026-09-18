import { describe, it, expect, beforeEach } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { caddie, caddiePersonalData, auditLog } from "@/db/schema";
import { uuidv7 } from "@/lib/uuid";
import { readBirthYear, writeBirthYear, eraseBirthYear } from "@/server/pii";
import { resetDb } from "../../helpers/reset-db";
import { testScope } from "../../helpers/scope";
import { makeCourse, makeAccount } from "../../helpers/fixtures";

/**
 * T063 — LE STARTER N'ATTEINT JAMAIS LES RENSEIGNEMENTS PERSONNELS.
 *
 * Le refus doit etre INDISCERNABLE d'un caddie inexistant : un Starter ne
 * doit pas meme pouvoir deduire qu'une annee de naissance est enregistree
 * (FR-020, FR-025, FR-030).
 */

let cedres: string;
let atlas: string;
let compte: string;
let caddieCedres: string;
let caddieAtlas: string;

beforeEach(async () => {
  await resetDb();
  cedres = await makeCourse("Golf des Cèdres");
  atlas = await makeCourse("Royal Atlas");
  compte = await makeAccount({ links: [{ courseId: cedres, role: "admin" }] });

  caddieCedres = uuidv7();
  caddieAtlas = uuidv7();
  await db.insert(caddie).values([
    {
      id: caddieCedres,
      golfCourseId: cedres,
      internalRef: "CED-001",
      firstName: "Hassan",
      lastName: "Fictif",
    },
    {
      id: caddieAtlas,
      golfCourseId: atlas,
      internalRef: "ATL-001",
      firstName: "Nabil",
      lastName: "Fictif",
    },
  ]);
  await db.insert(caddiePersonalData).values({ caddieId: caddieCedres, birthYear: 1988 });
});

const asAdmin = () => testScope({ accountId: compte, golfCourseId: cedres, role: "admin" });
const asStarter = () => testScope({ accountId: compte, golfCourseId: cedres, role: "starter" });

describe("refus opposé au Starter (FR-020)", () => {
  it("refuse la lecture d'une année de naissance", async () => {
    await expect(readBirthYear(asStarter(), caddieCedres)).rejects.toThrow(/droits/);
  });

  it("refuse l'écriture d'une année de naissance", async () => {
    await expect(writeBirthYear(asStarter(), caddieCedres, 1990)).rejects.toThrow(/droits/);
  });

  it("refuse l'effacement", async () => {
    await expect(eraseBirthYear(asStarter(), caddieCedres)).rejects.toThrow(/droits/);
  });

  it("refuse AVANT toute requête, donc sans rien journaliser", async () => {
    await readBirthYear(asStarter(), caddieCedres).catch(() => null);
    const entries = await db.select().from(auditLog);
    expect(entries).toEqual([]);
  });
});

describe("un caddie d'un autre terrain est traité comme inexistant (FR-025)", () => {
  it("refuse la lecture pour un administrateur hors portée", async () => {
    await expect(readBirthYear(asAdmin(), caddieAtlas)).rejects.toThrow(/introuvable/);
  });

  it("donne le même message pour un caddie inexistant et un caddie voisin", async () => {
    const inexistant = await readBirthYear(asAdmin(), uuidv7()).catch((e) => e.message);
    const voisin = await readBirthYear(asAdmin(), caddieAtlas).catch((e) => e.message);
    expect(inexistant).toBe(voisin);
  });
});

describe("accès administrateur : autorisé mais toujours journalisé (FR-036)", () => {
  it("lit l'année de naissance et journalise la consultation", async () => {
    expect(await readBirthYear(asAdmin(), caddieCedres)).toBe(1988);

    const entries = await db.select().from(auditLog).where(eq(auditLog.action, "pii.read"));
    expect(entries).toHaveLength(1);
    expect(entries[0]?.targetId).toBe(caddieCedres);
  });

  it("ne consigne JAMAIS la valeur lue dans le journal (FR-037)", async () => {
    await readBirthYear(asAdmin(), caddieCedres);
    const entries = await db.select().from(auditLog);
    expect(JSON.stringify(entries)).not.toContain("1988");
  });

  it("journalise l'écriture et la correction", async () => {
    await writeBirthYear(asAdmin(), caddieCedres, 1990);
    const entries = await db.select().from(auditLog).where(eq(auditLog.action, "pii.write"));
    expect(entries).toHaveLength(1);
    expect(await readBirthYear(asAdmin(), caddieCedres)).toBe(1990);
  });

  it("efface les renseignements sans toucher au caddie (FR-033)", async () => {
    await eraseBirthYear(asAdmin(), caddieCedres);

    expect(await readBirthYear(asAdmin(), caddieCedres)).toBeNull();

    const reste = await db.select().from(caddie).where(eq(caddie.id, caddieCedres));
    expect(reste).toHaveLength(1);
    expect(reste[0]?.internalRef).toBe("CED-001");
  });

  it("refuse une année de naissance hors bornes", async () => {
    await expect(writeBirthYear(asAdmin(), caddieCedres, 1800)).rejects.toThrow(/comprise entre/);
    await expect(writeBirthYear(asAdmin(), caddieCedres, 2030)).rejects.toThrow(/comprise entre/);
  });
});

describe("aucune lecture en lot n'est exposée", () => {
  it("le module n'offre que des opérations unitaires", async () => {
    const api = await import("@/server/pii");
    expect(Object.keys(api).sort()).toEqual(["eraseBirthYear", "readBirthYear", "writeBirthYear"]);
  });
});
