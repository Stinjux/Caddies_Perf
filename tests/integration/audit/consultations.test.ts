import { describe, it, expect, beforeEach } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "../../helpers/raw-db";
import { resetDb } from "../../helpers/reset-db";
import { makeCourse, makeAccount } from "../../helpers/fixtures";
import { testScope } from "../../helpers/scope";
import { auditLog } from "@/db/schema";
import { createCaddie } from "@/server/services/caddie";
import { listCaddies, findCaddie, listCaddiesForStarter } from "@/server/repositories/caddie";
import { listAccountsInScope } from "@/server/repositories/account";
import { listAuditInScope } from "@/server/repositories/audit";
import { exporterKpiCsv } from "@/server/services/rapports";

/**
 * « Journal des consultations ET des modifications ».
 *
 * Les modifications etaient deja couvertes. Ce fichier porte sur les
 * LECTURES, qui ne laissent aucune trace naturelle : sans entree explicite,
 * savoir qui a consulte quoi serait impossible apres coup.
 */

let parcours = "";
let adminId = "";

const admin = () => testScope({ accountId: adminId, golfCourseId: parcours, role: "admin" });
const starter = () => testScope({ accountId: adminId, golfCourseId: parcours, role: "starter" });

async function actions(): Promise<string[]> {
  const rows = await db
    .select({ action: auditLog.action })
    .from(auditLog)
    .where(eq(auditLog.golfCourseId, parcours));
  return rows.map((r) => r.action);
}

beforeEach(async () => {
  await resetDb();
  parcours = await makeCourse("Golf Fictif du Journal");
  adminId = await makeAccount({ links: [{ courseId: parcours, role: "admin" }] });
});

describe("les consultations laissent une trace", () => {
  it("journalise la lecture de la liste des caddies", async () => {
    await listCaddies(admin());
    expect(await actions()).toContain("caddie.list");
  });

  it("journalise la lecture d'une fiche caddie", async () => {
    const id = await createCaddie(admin(), {
      internalRef: "CED-001",
      firstName: "Hassan",
      lastName: "Fictif",
    });
    await findCaddie(admin(), id);

    const rows = await db
      .select({ action: auditLog.action, targetId: auditLog.targetId })
      .from(auditLog)
      .where(eq(auditLog.action, "caddie.read"));
    expect(rows).toHaveLength(1);
    expect(rows[0]?.targetId).toBe(id);
  });

  it("ne journalise RIEN quand la fiche demandee n'existe pas", async () => {
    // Une consultation qui n'a rien montre n'est pas une consultation.
    // L'inscrire ferait croire a un acces qui n'a pas eu lieu.
    await findCaddie(admin(), "00000000-0000-7000-8000-000000000000");
    expect(await actions()).not.toContain("caddie.read");
  });

  it("journalise la lecture de la liste des comptes", async () => {
    await listAccountsInScope(admin());
    expect(await actions()).toContain("account.list");
  });

  it("journalise la consultation du journal lui-meme", async () => {
    await listAuditInScope(admin());
    expect(await actions()).toContain("audit.read");
  });

  it("n'affiche pas sa propre entree dans la liste qu'elle rend", async () => {
    // Sinon chaque regard sur le journal brouillerait ce qu'il montre.
    const entrees = await listAuditInScope(admin());
    expect(entrees.map((e) => e.action)).not.toContain("audit.read");
    expect(await actions()).toContain("audit.read");
  });

  it("journalise l'export, qui emporte les donnees hors de l'application", async () => {
    await exporterKpiCsv(admin());
    expect(await actions()).toContain("report.export");
  });
});

describe("ce qui n'est PAS journalise, et pourquoi", () => {
  it("ne journalise pas l'ecran du Starter", async () => {
    // Liste blanche de champs, aucune donnee personnelle, aucune note — et
    // rafraichie des dizaines de fois par jour. L'y inclure noierait le
    // journal, et un journal que personne ne lit ne protege rien.
    await listCaddiesForStarter(starter());
    expect(await actions()).toEqual([]);
  });
});

describe("une entree de consultation ne dit pas CE QUI a ete lu", () => {
  it("ne porte que des identifiants internes", async () => {
    const id = await createCaddie(admin(), {
      internalRef: "CED-007",
      firstName: "Youssef",
      lastName: "Fictif",
    });
    await findCaddie(admin(), id);
    await listCaddies(admin());

    const rows = await db.select().from(auditLog);
    const serialise = JSON.stringify(rows);
    expect(serialise).not.toContain("Youssef");
    expect(serialise).not.toContain("CED-007");
  });
});
