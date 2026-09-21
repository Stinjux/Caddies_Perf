import { describe, it, expect, beforeEach, afterAll } from "vitest";
import postgres from "postgres";
import { db } from "../../helpers/raw-db";
import { auditLog } from "@/db/schema";
import { createAccount } from "@/server/services/account";
import { testDbUrl, resetDb } from "../../helpers/reset-db";
import { testScope } from "../../helpers/scope";
import { makeCourse, makeAccount, PASSWORD } from "../../helpers/fixtures";

/**
 * T071 — LE JOURNAL EST INALTERABLE (FR-038).
 *
 * L'exigence n'est PAS "l'application ne modifie pas le journal" : c'est
 * "l'application NE PEUT PAS le modifier". La difference tient au role
 * PostgreSQL, qui ne recoit que INSERT et SELECT.
 *
 * Ces tests prennent l'identite du role applicatif (SET ROLE) pour eprouver
 * les droits reels, et non ceux du proprietaire de la base.
 */

const sql = postgres(testDbUrl(), { max: 1 });
afterAll(() => sql.end());

let courseId: string;
let adminId: string;

beforeEach(async () => {
  await resetDb();
  courseId = await makeCourse("Golf des Cèdres");
  adminId = await makeAccount({ links: [{ courseId, role: "admin" }] });
  await createAccount(testScope({ accountId: adminId, golfCourseId: courseId, role: "admin" }), {
    email: "trace@example.invalid",
    firstName: "P",
    lastName: "F",
    password: PASSWORD,
    role: "starter",
  });
});

describe("droits du rôle applicatif sur le journal", () => {
  it("n'accorde que INSERT et SELECT", async () => {
    const rows = await sql<{ privilege_type: string }[]>`
      SELECT privilege_type FROM information_schema.table_privileges
      WHERE grantee = 'caddieperf_app' AND table_name = 'audit_log'
      ORDER BY privilege_type
    `;
    expect(rows.map((r) => r.privilege_type)).toEqual(["INSERT", "SELECT"]);
  });

  it("REFUSE une modification d'entrée au rôle applicatif", async () => {
    await expect(
      sql.begin(async (tx) => {
        await tx`SET LOCAL ROLE caddieperf_app`;
        await tx`UPDATE audit_log SET action = 'falsifie'`;
      }),
    ).rejects.toThrow(/permission denied/i);
  });

  it("REFUSE une suppression d'entrée au rôle applicatif", async () => {
    await expect(
      sql.begin(async (tx) => {
        await tx`SET LOCAL ROLE caddieperf_app`;
        await tx`DELETE FROM audit_log`;
      }),
    ).rejects.toThrow(/permission denied/i);
  });

  it("REFUSE un vidage de la table au rôle applicatif", async () => {
    await expect(
      sql.begin(async (tx) => {
        await tx`SET LOCAL ROLE caddieperf_app`;
        await tx`TRUNCATE audit_log`;
      }),
    ).rejects.toThrow(/permission denied|must be owner/i);
  });

  it("AUTORISE la lecture et l'insertion, qui sont le fonctionnement normal", async () => {
    const avant = (await db.select().from(auditLog)).length;

    await sql.begin(async (tx) => {
      await tx`SET LOCAL ROLE caddieperf_app`;
      // Le role applicatif est soumis au RLS : sans parcours courant, il ne voit
      // ni n'ecrit rien. C'est ce que fait withScope() dans l'application.
      await tx`SELECT set_config('app.golf_course_id', ${courseId}, true)`;
      await tx`SELECT count(*) FROM audit_log`;
      await tx`INSERT INTO audit_log (id, golf_course_id, actor_account_id, action, target_type)
               VALUES (gen_random_uuid(), ${courseId}, ${adminId}, 'course.update', 'golf_course')`;
    });

    expect((await db.select().from(auditLog)).length).toBe(avant + 1);
  });
});

describe("l'entrée subsiste après toute tentative", () => {
  it("conserve les entrées intactes", async () => {
    const avant = await db.select().from(auditLog);

    await sql
      .begin(async (tx) => {
        await tx`SET LOCAL ROLE caddieperf_app`;
        await tx`UPDATE audit_log SET action = 'falsifie'`;
      })
      .catch(() => null);

    const apres = await db.select().from(auditLog);
    expect(apres).toEqual(avant);
    expect(apres.every((e) => e.action !== "falsifie")).toBe(true);
  });
});

describe("aucune fonction de modification n'est exposée par l'application", () => {
  it("le module de journal n'offre que l'écriture", async () => {
    const api = await import("@/server/audit/write");
    const fonctions = Object.keys(api).filter((k) => typeof (api as never)[k] === "function");
    expect(fonctions).toEqual(["writeAudit"]);
  });

  it("le dépôt de lecture n'offre aucune mutation", async () => {
    const api = await import("@/server/repositories/audit");
    expect(Object.keys(api).sort()).toEqual(["listAuditInScope"]);
  });
});
