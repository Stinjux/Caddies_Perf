import { describe, it, expect, beforeEach } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "../helpers/raw-db";
import { account, accountGolfCourse } from "@/db/schema";
import { disableAccount } from "@/server/services/account";
import { attachAccount, detachAccount } from "@/server/services/account-course";
import { resetDb } from "../helpers/reset-db";
import { testScope } from "../helpers/scope";
import { makeCourse, makeAccount } from "../helpers/fixtures";

/**
 * T044 — INVARIANT DU DERNIER ADMINISTRATEUR (FR-015).
 * Un terrain actif ne doit JAMAIS se retrouver sans administrateur actif,
 * par aucun chemin.
 */

let courseId: string;
let adminId: string;

beforeEach(async () => {
  await resetDb();
  courseId = await makeCourse("Golf des Cèdres");
  adminId = await makeAccount({ links: [{ courseId, role: "admin" }] });
});

const asAdmin = (id = adminId) =>
  testScope({ accountId: id, golfCourseId: courseId, role: "admin" });

async function activeAdmins(): Promise<number> {
  const rows = await db
    .select({ id: account.id })
    .from(accountGolfCourse)
    .innerJoin(account, eq(account.id, accountGolfCourse.accountId))
    .where(eq(accountGolfCourse.golfCourseId, courseId));
  return rows.length;
}

describe("désactivation du dernier administrateur", () => {
  it("refuse de désactiver le seul administrateur actif", async () => {
    await expect(disableAccount(asAdmin(), adminId, 1)).rejects.toThrow(
      /au moins un administrateur actif/,
    );
    const rows = await db.select().from(account).where(eq(account.id, adminId));
    expect(rows[0]?.status).toBe("active");
  });

  it("autorise la désactivation dès qu'un second administrateur actif existe", async () => {
    const second = await makeAccount({ links: [{ courseId, role: "admin" }] });
    await disableAccount(asAdmin(second), adminId, 1);

    const rows = await db.select().from(account).where(eq(account.id, adminId));
    expect(rows[0]?.status).toBe("disabled");
  });

  it("ne compte pas un administrateur déjà désactivé comme rempart", async () => {
    const second = await makeAccount({ status: "disabled", links: [{ courseId, role: "admin" }] });
    expect(second).toBeTruthy();
    await expect(disableAccount(asAdmin(), adminId, 1)).rejects.toThrow(
      /au moins un administrateur actif/,
    );
  });

  it("ne compte pas un Starter comme administrateur", async () => {
    await makeAccount({ links: [{ courseId, role: "starter" }] });
    await expect(disableAccount(asAdmin(), adminId, 1)).rejects.toThrow(
      /au moins un administrateur actif/,
    );
  });

  it("ne compte pas un administrateur d'un AUTRE terrain", async () => {
    const autre = await makeCourse("Royal Atlas");
    await makeAccount({ links: [{ courseId: autre, role: "admin" }] });
    await expect(disableAccount(asAdmin(), adminId, 1)).rejects.toThrow(
      /au moins un administrateur actif/,
    );
  });
});

describe("détachement du dernier administrateur", () => {
  it("refuse de détacher le seul administrateur actif", async () => {
    await expect(detachAccount(asAdmin(), adminId)).rejects.toThrow(
      /au moins un administrateur actif/,
    );
    expect(await activeAdmins()).toBe(1);
  });

  it("autorise le détachement dès qu'un second administrateur actif existe", async () => {
    const second = await makeAccount({ links: [{ courseId, role: "admin" }] });
    await detachAccount(asAdmin(second), adminId);
    expect(await activeAdmins()).toBe(1);
  });

  it("autorise toujours le détachement d'un Starter", async () => {
    const starter = await makeAccount({ links: [{ courseId, role: "starter" }] });
    await detachAccount(asAdmin(), starter);
    expect(await activeAdmins()).toBe(1);
  });
});

describe("rattachement (FR-010)", () => {
  it("rattache un compte existant au terrain actif", async () => {
    const autre = await makeCourse("Royal Atlas");
    const compte = await makeAccount({ links: [{ courseId: autre, role: "starter" }] });

    await attachAccount(asAdmin(), compte, "starter");
    expect(await activeAdmins()).toBe(2);
  });

  it("refuse un double rattachement au même terrain", async () => {
    const compte = await makeAccount({ links: [{ courseId, role: "starter" }] });
    await expect(attachAccount(asAdmin(), compte, "admin")).rejects.toThrow(/déjà rattaché/);
  });

  it("traite un compte inexistant comme introuvable", async () => {
    await expect(
      attachAccount(asAdmin(), "00000000-0000-7000-8000-000000000000", "starter"),
    ).rejects.toThrow(/introuvable/);
  });
});
