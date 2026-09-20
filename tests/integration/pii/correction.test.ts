import { describe, it, expect, beforeEach } from "vitest";
import { champsMetier } from "../../helpers/champs-metier";
import { eq } from "drizzle-orm";
import { db } from "../../helpers/raw-db";
import { caddie, caddiePersonalData, auditLog } from "@/db/schema";
import { uuidv7 } from "@/lib/uuid";
import { readBirthYear, writeBirthYear } from "@/server/pii";
import { resetDb } from "../../helpers/reset-db";
import { testScope } from "../../helpers/scope";
import { makeCourse, makeAccount } from "../../helpers/fixtures";

/** T074 — correction des renseignements personnels (FR-033). */

let courseId: string;
let adminId: string;
let caddieId: string;

beforeEach(async () => {
  await resetDb();
  courseId = await makeCourse("Golf des Cèdres");
  adminId = await makeAccount({ links: [{ courseId, role: "admin" }] });
  caddieId = uuidv7();
  await db.insert(caddie).values({
    id: caddieId,
    golfCourseId: courseId,
    internalRef: "CED-001",
    firstName: "Hassan",
    lastName: "Fictif",
  });
});

const scope = () => testScope({ accountId: adminId, golfCourseId: courseId, role: "admin" });

describe("correction d'une année de naissance", () => {
  it("enregistre une première valeur", async () => {
    await writeBirthYear(scope(), caddieId, 1988);
    expect(await readBirthYear(scope(), caddieId)).toBe(1988);
  });

  it("remplace une valeur existante sans créer de doublon", async () => {
    await writeBirthYear(scope(), caddieId, 1988);
    await writeBirthYear(scope(), caddieId, 1990);

    expect(await readBirthYear(scope(), caddieId)).toBe(1990);

    const rows = await db
      .select()
      .from(caddiePersonalData)
      .where(eq(caddiePersonalData.caddieId, caddieId));
    expect(rows).toHaveLength(1);
  });

  it("met à jour l'horodatage de modification", async () => {
    await writeBirthYear(scope(), caddieId, 1988);
    const avant = (
      await db.select().from(caddiePersonalData).where(eq(caddiePersonalData.caddieId, caddieId))
    )[0]!.updatedAt;

    await new Promise((r) => setTimeout(r, 15));
    await writeBirthYear(scope(), caddieId, 1991);

    const apres = (
      await db.select().from(caddiePersonalData).where(eq(caddiePersonalData.caddieId, caddieId))
    )[0]!.updatedAt;

    expect(apres.getTime()).toBeGreaterThan(avant.getTime());
  });

  it("journalise chaque correction (FR-036)", async () => {
    await writeBirthYear(scope(), caddieId, 1988);
    await writeBirthYear(scope(), caddieId, 1990);

    const ecritures = await db.select().from(auditLog).where(eq(auditLog.action, "pii.write"));
    expect(ecritures).toHaveLength(2);
    expect(ecritures.every((e) => e.targetId === caddieId)).toBe(true);
  });

  it("ne consigne ni l'ancienne ni la nouvelle valeur (FR-037)", async () => {
    await writeBirthYear(scope(), caddieId, 1988);
    await writeBirthYear(scope(), caddieId, 1990);

    const journal = champsMetier(await db.select().from(auditLog));
    expect(journal).not.toContain("1988");
    expect(journal).not.toContain("1990");
  });

  it("n'altère jamais l'identité professionnelle du caddie", async () => {
    await writeBirthYear(scope(), caddieId, 1988);

    const rows = await db.select().from(caddie).where(eq(caddie.id, caddieId));
    expect(rows[0]?.internalRef).toBe("CED-001");
    expect(rows[0]?.firstName).toBe("Hassan");
    expect(rows[0]?.version).toBe(1);
  });
});

describe("bornes de validation", () => {
  it("refuse une année antérieure à 1940", async () => {
    await expect(writeBirthYear(scope(), caddieId, 1939)).rejects.toThrow(/comprise entre/);
  });

  it("refuse une année impliquant un âge inférieur à 15 ans", async () => {
    const trop_recent = new Date().getFullYear() - 14;
    await expect(writeBirthYear(scope(), caddieId, trop_recent)).rejects.toThrow(/comprise entre/);
  });

  it("refuse une valeur non entière", async () => {
    await expect(writeBirthYear(scope(), caddieId, 1988.5)).rejects.toThrow(/comprise entre/);
  });

  it("n'écrit rien quand la validation échoue", async () => {
    await writeBirthYear(scope(), caddieId, 1988);
    await writeBirthYear(scope(), caddieId, 1800).catch(() => null);

    expect(await readBirthYear(scope(), caddieId)).toBe(1988);
  });
});
