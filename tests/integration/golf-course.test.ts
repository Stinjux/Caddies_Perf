import { describe, it, expect, beforeEach } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "../helpers/raw-db";
import { golfCourse, account, accountGolfCourse, auditLog } from "@/db/schema";
import { uuidv7 } from "@/lib/uuid";
import { hashPassword } from "@/server/auth/password";
import { createCourse, updateCourse, archiveCourse } from "@/server/services/golf-course";
import { findCourseInScope, listCoursesForAccount } from "@/server/repositories/golf-course";
import { resetDb } from "../helpers/reset-db";
import { testScope } from "../helpers/scope";
import { courses } from "../../fixtures/seed-data";

/** Scenario V-1 — creation, lecture, modification et archivage d'un terrain. */

const cedres = courses[0];
let adminId: string;

beforeEach(async () => {
  await resetDb();
  adminId = uuidv7();
  await db.insert(account).values({
    id: adminId,
    email: `admin.${adminId}@example.invalid`,
    firstName: "Amina",
    lastName: "Exemple",
    passwordHash: await hashPassword("MotDePasseFictif1!"),
  });
});

describe("V-1 — cycle de vie d'un terrain", () => {
  it("cree un terrain et lui attribue un identifiant permanent", async () => {
    const id = await createCourse(adminId, {
      name: cedres.name,
      address: cedres.address,
      timezone: cedres.timezone,
      googleReviewUrl: cedres.googleReviewUrl,
    });

    const scope = testScope({ accountId: adminId, golfCourseId: id, role: "admin" });
    const row = await findCourseInScope(scope, id);

    expect(row?.name).toBe(cedres.name);
    expect(row?.timezone).toBe(cedres.timezone);
    expect(row?.googleReviewUrl).toBe(cedres.googleReviewUrl);
    expect(row?.status).toBe("active");
    expect(row?.version).toBe(1);
  });

  it("rattache d'office son createur comme administrateur (FR-015)", async () => {
    const id = await createCourse(adminId, { name: cedres.name, timezone: cedres.timezone });
    const links = await db
      .select()
      .from(accountGolfCourse)
      .where(eq(accountGolfCourse.golfCourseId, id));

    expect(links).toHaveLength(1);
    expect(links[0]?.role).toBe("admin");
  });

  it("journalise la creation sans aucune donnee personnelle (FR-035, FR-037)", async () => {
    const id = await createCourse(adminId, { name: cedres.name, timezone: cedres.timezone });
    const entries = await db.select().from(auditLog).where(eq(auditLog.golfCourseId, id));

    expect(entries).toHaveLength(1);
    expect(entries[0]?.action).toBe("course.create");
    expect(entries[0]?.actorAccountId).toBe(adminId);
    expect(Object.values(entries[0] ?? {}).join(" ")).not.toContain(cedres.name);
  });

  it("modifie un terrain et incremente sa version", async () => {
    const id = await createCourse(adminId, { name: cedres.name, timezone: cedres.timezone });
    const scope = testScope({ accountId: adminId, golfCourseId: id, role: "admin" });

    await updateCourse(scope, { name: "Nom Fictif Modifié", timezone: cedres.timezone }, 1);

    const row = await findCourseInScope(scope, id);
    expect(row?.name).toBe("Nom Fictif Modifié");
    expect(row?.version).toBe(2);
  });

  it("refuse une modification portant une version perimee (FR-045)", async () => {
    const id = await createCourse(adminId, { name: cedres.name, timezone: cedres.timezone });
    const scope = testScope({ accountId: adminId, golfCourseId: id, role: "admin" });

    await updateCourse(scope, { name: "Première", timezone: cedres.timezone }, 1);
    await expect(
      updateCourse(scope, { name: "Seconde", timezone: cedres.timezone }, 1),
    ).rejects.toThrow(/modifiée entre-temps/);

    const row = await findCourseInScope(scope, id);
    expect(row?.name).toBe("Première");
  });

  it("archive un terrain au lieu de le supprimer (FR-006)", async () => {
    const id = await createCourse(adminId, { name: cedres.name, timezone: cedres.timezone });
    const scope = testScope({ accountId: adminId, golfCourseId: id, role: "admin" });

    await archiveCourse(scope, 1);

    const row = await findCourseInScope(scope, id);
    expect(row).not.toBeNull();
    expect(row?.status).toBe("archived");
  });

  it("refuse toute modification a un compte Starter (FR-021)", async () => {
    const id = await createCourse(adminId, { name: cedres.name, timezone: cedres.timezone });
    const starter = testScope({ accountId: adminId, golfCourseId: id, role: "starter" });

    await expect(
      updateCourse(starter, { name: "Interdit", timezone: cedres.timezone }, 1),
    ).rejects.toThrow(/droits/);
  });
});

describe("V-3 — cloisonnement applicatif", () => {
  it("ne remonte rien pour un terrain hors de la portee (FR-025)", async () => {
    const a = await createCourse(adminId, { name: "Terrain A", timezone: "Africa/Casablanca" });
    const b = await createCourse(adminId, { name: "Terrain B", timezone: "Africa/Casablanca" });

    const scopeA = testScope({ accountId: adminId, golfCourseId: a, role: "admin" });
    expect(await findCourseInScope(scopeA, b)).toBeNull();
    expect(await findCourseInScope(scopeA, a)).not.toBeNull();
  });

  it("ne liste que les terrains rattaches au compte (FR-023)", async () => {
    await createCourse(adminId, { name: "Terrain A", timezone: "Africa/Casablanca" });

    const autre = uuidv7();
    await db.insert(account).values({
      id: autre,
      email: `autre.${autre}@example.invalid`,
      firstName: "Sofia",
      lastName: "Exemple",
      passwordHash: await hashPassword("MotDePasseFictif3!"),
    });
    await createCourse(autre, { name: "Terrain B", timezone: "Africa/Casablanca" });

    const mine = await listCoursesForAccount(adminId);
    expect(mine.map((c) => c.name)).toEqual(["Terrain A"]);
  });
});
