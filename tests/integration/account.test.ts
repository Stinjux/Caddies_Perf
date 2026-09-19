import { describe, it, expect, beforeEach } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "../helpers/raw-db";
import { account, auditLog } from "@/db/schema";
import { createAccount, disableAccount, enableAccount } from "@/server/services/account";
import { listAccountsInScope, findAccountInScope } from "@/server/repositories/account";
import { resetDb } from "../helpers/reset-db";
import { testScope } from "../helpers/scope";
import { makeCourse, makeAccount, PASSWORD } from "../helpers/fixtures";

/** T043 — creation de comptes, unicite, et non-exposition du hache. */

let courseId: string;
let adminId: string;

beforeEach(async () => {
  await resetDb();
  courseId = await makeCourse("Golf des Cèdres");
  adminId = await makeAccount({ links: [{ courseId, role: "admin" }] });
});

const asAdmin = () => testScope({ accountId: adminId, golfCourseId: courseId, role: "admin" });

describe("création de comptes (FR-009, FR-011)", () => {
  it("crée un compte Starter rattaché au terrain actif", async () => {
    const id = await createAccount(asAdmin(), {
      email: "starter.cedres@example.invalid",
      firstName: "Karim",
      lastName: "Exemple",
      password: PASSWORD,
      role: "starter",
    });

    const list = await listAccountsInScope(asAdmin());
    const created = list.find((a) => a.id === id);
    expect(created?.role).toBe("starter");
    expect(created?.status).toBe("active");
  });

  it("refuse une adresse de courriel déjà utilisée", async () => {
    const input = {
      email: "doublon@example.invalid",
      firstName: "Karim",
      lastName: "Exemple",
      password: PASSWORD,
      role: "starter" as const,
    };
    await createAccount(asAdmin(), input);
    await expect(createAccount(asAdmin(), input)).rejects.toThrow(/déjà utilisée/);
  });

  it("normalise l'adresse en minuscules", async () => {
    const id = await createAccount(asAdmin(), {
      email: "MAJUSCULES@Example.Invalid",
      firstName: "Sofia",
      lastName: "Exemple",
      password: PASSWORD,
      role: "admin",
    });
    const rows = await db.select().from(account).where(eq(account.id, id));
    expect(rows[0]?.email).toBe("majuscules@example.invalid");
  });

  it("refuse un mot de passe trop court", async () => {
    await expect(
      createAccount(asAdmin(), {
        email: "court@example.invalid",
        firstName: "A",
        lastName: "B",
        password: "court",
        role: "starter",
      }),
    ).rejects.toThrow(/12 caractères/);
  });

  it("refuse une adresse mal formée", async () => {
    await expect(
      createAccount(asAdmin(), {
        email: "pas-une-adresse",
        firstName: "A",
        lastName: "B",
        password: PASSWORD,
        role: "starter",
      }),
    ).rejects.toThrow(/n'est pas valide/);
  });

  it("interdit la création à un compte Starter (FR-020)", async () => {
    const starter = testScope({ accountId: adminId, golfCourseId: courseId, role: "starter" });
    await expect(
      createAccount(starter, {
        email: "interdit@example.invalid",
        firstName: "A",
        lastName: "B",
        password: PASSWORD,
        role: "starter",
      }),
    ).rejects.toThrow(/droits/);
  });
});

describe("non-exposition du haché de mot de passe (FR-017)", () => {
  it("ne renvoie jamais passwordHash dans une liste", async () => {
    const list = await listAccountsInScope(asAdmin());
    for (const a of list) {
      expect(Object.keys(a)).not.toContain("passwordHash");
    }
  });

  it("ne renvoie jamais passwordHash dans une lecture unitaire", async () => {
    const found = await findAccountInScope(asAdmin(), adminId);
    expect(found).not.toBeNull();
    expect(Object.keys(found!)).not.toContain("passwordHash");
  });
});

describe("désactivation et réactivation (FR-014)", () => {
  it("désactive un Starter et conserve son historique", async () => {
    const starterId = await makeAccount({ links: [{ courseId, role: "starter" }] });
    await disableAccount(asAdmin(), starterId, 1);

    const rows = await db.select().from(account).where(eq(account.id, starterId));
    expect(rows[0]?.status).toBe("disabled");

    const entries = await db.select().from(auditLog).where(eq(auditLog.targetId, starterId));
    expect(entries.map((e) => e.action)).toContain("account.disable");
  });

  it("réactive un compte désactivé", async () => {
    const starterId = await makeAccount({ links: [{ courseId, role: "starter" }] });
    await disableAccount(asAdmin(), starterId, 1);
    await enableAccount(asAdmin(), starterId, 2);

    const rows = await db.select().from(account).where(eq(account.id, starterId));
    expect(rows[0]?.status).toBe("active");
  });

  it("refuse une désactivation portant une version périmée (FR-045)", async () => {
    const starterId = await makeAccount({ links: [{ courseId, role: "starter" }] });
    await expect(disableAccount(asAdmin(), starterId, 99)).rejects.toThrow(/modifiée entre-temps/);
  });

  it("traite un compte d'un autre terrain comme inexistant (FR-025)", async () => {
    const autre = await makeCourse("Royal Atlas");
    const etranger = await makeAccount({ links: [{ courseId: autre, role: "starter" }] });
    await expect(disableAccount(asAdmin(), etranger, 1)).rejects.toThrow(/introuvable/);
  });
});
