import { describe, it, expect, beforeEach } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "../helpers/raw-db";
import { session } from "@/db/schema";
import { login, resolveSession } from "@/server/auth/current";
import { disableAccount } from "@/server/services/account";
import { detachAccount } from "@/server/services/account-course";
import { resetDb } from "../helpers/reset-db";
import { testScope } from "../helpers/scope";
import { makeCourse, makeAccount, PASSWORD } from "../helpers/fixtures";

/**
 * T046 — FR-016 : une session ne survit pas a la desactivation de son compte.
 * C'est precisement ce qu'un jeton sans etat ne permettrait pas sans registre
 * de revocation : la raison qui a fait ecarter les JWT (research.md §2).
 */

let courseId: string;
let adminId: string;

beforeEach(async () => {
  await resetDb();
  courseId = await makeCourse("Golf des Cèdres");
  adminId = await makeAccount({ links: [{ courseId, role: "admin" }] });
});

const asAdmin = () => testScope({ accountId: adminId, golfCourseId: courseId, role: "admin" });

describe("révocation immédiate d'une session (FR-016)", () => {
  it("invalide la session dès l'action suivant la désactivation", async () => {
    await makeAccount({
      email: "cible@example.invalid",
      links: [{ courseId, role: "starter" }],
    });
    const token = (await login("cible@example.invalid", PASSWORD)).token;
    expect(await resolveSession(token)).not.toBeNull();

    const cible = (await resolveSession(token))!.accountId;
    await disableAccount(asAdmin(), cible, 1);

    expect(await resolveSession(token)).toBeNull();
  });

  it("supprime physiquement la session de la base", async () => {
    await makeAccount({ email: "efface@example.invalid", links: [{ courseId, role: "starter" }] });
    const token = (await login("efface@example.invalid", PASSWORD)).token;
    const cible = (await resolveSession(token))!.accountId;

    await disableAccount(asAdmin(), cible, 1);

    const rows = await db.select().from(session).where(eq(session.accountId, cible));
    expect(rows).toEqual([]);
  });

  it("invalide toutes les sessions du compte, pas seulement la dernière", async () => {
    await makeAccount({ email: "multi@example.invalid", links: [{ courseId, role: "starter" }] });
    const t1 = (await login("multi@example.invalid", PASSWORD)).token;
    const t2 = (await login("multi@example.invalid", PASSWORD)).token;

    const cible = (await resolveSession(t1))!.accountId;
    await disableAccount(asAdmin(), cible, 1);

    expect(await resolveSession(t1)).toBeNull();
    expect(await resolveSession(t2)).toBeNull();
  });

  it("n'affecte pas les sessions des autres comptes", async () => {
    await makeAccount({ email: "a@example.invalid", links: [{ courseId, role: "starter" }] });
    await makeAccount({ email: "b@example.invalid", links: [{ courseId, role: "starter" }] });
    const ta = (await login("a@example.invalid", PASSWORD)).token;
    const tb = (await login("b@example.invalid", PASSWORD)).token;

    await disableAccount(asAdmin(), (await resolveSession(ta))!.accountId, 1);

    expect(await resolveSession(ta)).toBeNull();
    expect(await resolveSession(tb)).not.toBeNull();
  });
});

describe("perte de portée après détachement (P-1)", () => {
  it("retire la portée quand le rattachement au terrain actif disparaît", async () => {
    await makeAccount({ email: "detache@example.invalid", links: [{ courseId, role: "starter" }] });
    const token = (await login("detache@example.invalid", PASSWORD)).token;
    expect((await resolveSession(token))?.scope).not.toBeNull();

    await detachAccount(asAdmin(), (await resolveSession(token))!.accountId);

    const ctx = await resolveSession(token);
    expect(ctx).not.toBeNull();
    expect(ctx?.scope).toBeNull();
    expect(ctx?.activeGolfCourseId).toBeNull();
  });
});
