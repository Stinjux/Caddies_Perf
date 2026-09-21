import { describe, it, expect, beforeEach } from "vitest";
import { db } from "../../helpers/raw-db";
import { auditLog, caddie, caddiePersonalData } from "@/db/schema";
import { uuidv7 } from "@/lib/uuid";
import { createCourse, updateCourse, archiveCourse } from "@/server/services/golf-course";
import { createAccount, disableAccount, enableAccount } from "@/server/services/account";
import { attachAccount, detachAccount } from "@/server/services/account-course";
import { readBirthYear, writeBirthYear, eraseBirthYear } from "@/server/pii";
import { listAuditInScope } from "@/server/repositories/audit";
import { resetDb } from "../../helpers/reset-db";
import { testScope } from "../../helpers/scope";
import { makeCourse, makeAccount, PASSWORD } from "../../helpers/fixtures";

/**
 * T069 — COUVERTURE DU JOURNAL (FR-035, FR-036).
 *
 * Chaque mutation administrative et chaque acces aux renseignements
 * personnels DOIT laisser une trace. Une operation non journalisee est un
 * trou dans la responsabilite.
 */

let courseId: string;
let adminId: string;

beforeEach(async () => {
  await resetDb();
  courseId = await makeCourse("Golf des Cèdres");
  // Créer un parcours relève du niveau général (voir services/golf-course).
  adminId = await makeAccount({ generalAdmin: true, links: [{ courseId, role: "admin" }] });
});

const scope = () => testScope({ accountId: adminId, golfCourseId: courseId, role: "admin" });

async function actions(): Promise<string[]> {
  const rows = await db.select({ action: auditLog.action }).from(auditLog);
  return rows.map((r) => r.action).sort();
}

describe("mutations de parcours", () => {
  it("journalise la création, la modification et l'archivage", async () => {
    const id = await createCourse(adminId, { name: "Nouveau", timezone: "Africa/Casablanca" });
    const s = testScope({ accountId: adminId, golfCourseId: id, role: "admin" });

    await updateCourse(s, { name: "Modifié", timezone: "Africa/Casablanca" }, 1);
    await archiveCourse(s, 2);

    expect(await actions()).toEqual(["course.archive", "course.create", "course.update"]);
  });
});

describe("mutations de compte", () => {
  it("journalise création, désactivation et réactivation", async () => {
    const id = await createAccount(scope(), {
      email: "trace@example.invalid",
      firstName: "P",
      lastName: "F",
      password: PASSWORD,
      role: "starter",
    });
    await disableAccount(scope(), id, 1);
    await enableAccount(scope(), id, 2);

    expect(await actions()).toEqual(["account.create", "account.disable", "account.enable"]);
  });

  it("journalise rattachement et détachement", async () => {
    const autre = await makeCourse("Royal Atlas");
    const compte = await makeAccount({ links: [{ courseId: autre, role: "starter" }] });

    await attachAccount(scope(), compte, "starter");
    await detachAccount(scope(), compte);

    expect(await actions()).toEqual(["account.attach", "account.detach"]);
  });
});

describe("accès aux renseignements personnels (FR-036)", () => {
  it("journalise lecture, écriture et effacement", async () => {
    const caddieId = uuidv7();
    await db.insert(caddie).values({
      id: caddieId,
      golfCourseId: courseId,
      internalRef: "CED-001",
      firstName: "Hassan",
      lastName: "Fictif",
    });
    await db.insert(caddiePersonalData).values({ caddieId, birthYear: 1988 });

    await readBirthYear(scope(), caddieId);
    await writeBirthYear(scope(), caddieId, 1990);
    await eraseBirthYear(scope(), caddieId);

    expect(await actions()).toEqual(["pii.erase", "pii.read", "pii.write"]);
  });

  it("journalise CHAQUE consultation, pas seulement la première", async () => {
    const caddieId = uuidv7();
    await db.insert(caddie).values({
      id: caddieId,
      golfCourseId: courseId,
      internalRef: "CED-002",
      firstName: "Omar",
      lastName: "Fictif",
    });

    await readBirthYear(scope(), caddieId);
    await readBirthYear(scope(), caddieId);
    await readBirthYear(scope(), caddieId);

    const lectures = (await actions()).filter((a) => a === "pii.read");
    expect(lectures).toHaveLength(3);
  });
});

describe("contenu d'une entrée (FR-035)", () => {
  it("porte auteur, parcours, nature, cible et horodatage", async () => {
    await createAccount(scope(), {
      email: "champs@example.invalid",
      firstName: "P",
      lastName: "F",
      password: PASSWORD,
      role: "starter",
    });

    const rows = await db.select().from(auditLog);
    const entry = rows[0]!;

    expect(entry.actorAccountId).toBe(adminId);
    expect(entry.golfCourseId).toBe(courseId);
    expect(entry.action).toBe("account.create");
    expect(entry.targetType).toBe("account");
    expect(entry.targetId).toBeTruthy();
    expect(entry.occurredAt).toBeInstanceOf(Date);
  });

  it("n'écrit rien quand la mutation échoue", async () => {
    await createAccount(scope(), {
      email: "unique@example.invalid",
      firstName: "P",
      lastName: "F",
      password: PASSWORD,
      role: "starter",
    });

    await createAccount(scope(), {
      email: "unique@example.invalid",
      firstName: "P",
      lastName: "F",
      password: PASSWORD,
      role: "starter",
    }).catch(() => null);

    // La transaction ayant echoue, aucune seconde entree ne subsiste.
    expect((await actions()).filter((a) => a === "account.create")).toHaveLength(1);
  });
});

describe("filtres de consultation (FR-039)", () => {
  it("filtre par nature d'action", async () => {
    const id = await createAccount(scope(), {
      email: "filtre@example.invalid",
      firstName: "P",
      lastName: "F",
      password: PASSWORD,
      role: "starter",
    });
    await disableAccount(scope(), id, 1);

    const filtre = await listAuditInScope(scope(), { action: "account.disable" });
    expect(filtre).toHaveLength(1);
    expect(filtre[0]?.action).toBe("account.disable");
  });

  it("filtre par auteur", async () => {
    await createAccount(scope(), {
      email: "auteur@example.invalid",
      firstName: "P",
      lastName: "F",
      password: PASSWORD,
      role: "starter",
    });

    expect(await listAuditInScope(scope(), { actorAccountId: adminId })).toHaveLength(1);
    expect(await listAuditInScope(scope(), { actorAccountId: uuidv7() })).toHaveLength(0);
  });

  it("filtre par période", async () => {
    await createAccount(scope(), {
      email: "periode@example.invalid",
      firstName: "P",
      lastName: "F",
      password: PASSWORD,
      role: "starter",
    });

    const hier = new Date(Date.now() - 86_400_000);
    const demain = new Date(Date.now() + 86_400_000);

    expect(await listAuditInScope(scope(), { from: hier, to: demain })).toHaveLength(1);
    expect(await listAuditInScope(scope(), { from: demain })).toHaveLength(0);
  });
});
