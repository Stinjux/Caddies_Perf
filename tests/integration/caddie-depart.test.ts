import { describe, it, expect, beforeEach } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "../helpers/raw-db";
import { resetDb } from "../helpers/reset-db";
import { makeCourse, makeAccount } from "../helpers/fixtures";
import { testScope } from "../helpers/scope";
import { caddie, assignment, evaluation } from "@/db/schema";
import { createCaddie, archiverCaddie } from "@/server/services/caddie";
import { createCart } from "@/server/services/cart";
import { creerAffectation } from "@/server/services/assignment";
import { listCaddiesForStarter } from "@/server/repositories/caddie";
import { soumettreEvaluation } from "@/server/services/evaluation";

/**
 * DEPART D'UN CADDIE — « suppression ou archivage des employes partis ».
 *
 * Deux exigences se contredisent en apparence : l'employe parti ne doit plus
 * figurer nulle part operationnellement, et son historique doit demeurer,
 * faute de quoi la moyenne du parcours change retroactivement et fausse la
 * comparaison de TOUS les autres caddies. L'archivage tranche : il retire du
 * present sans toucher au passe.
 */

let terrain = "";
let adminId = "";
const admin = () => testScope({ accountId: adminId, golfCourseId: terrain, role: "admin" });
const starter = () => testScope({ accountId: adminId, golfCourseId: terrain, role: "starter" });

async function unCaddie(ref = "CED-001"): Promise<string> {
  return createCaddie(admin(), { internalRef: ref, firstName: "Hassan", lastName: "Fictif" });
}

beforeEach(async () => {
  await resetDb();
  terrain = await makeCourse("Golf Fictif des Departs");
  adminId = await makeAccount({ links: [{ courseId: terrain, role: "admin" }] });
});

describe("archivage d'un caddie parti", () => {
  it("le desactive et le rend indisponible", async () => {
    const id = await unCaddie();
    await archiverCaddie(admin(), id, 1);

    const [row] = await db.select().from(caddie).where(eq(caddie.id, id));
    expect(row?.status).toBe("disabled");
    expect(row?.availability).toBe("unavailable");
  });

  it("le retire de l'ecran du Starter", async () => {
    const id = await unCaddie();
    await archiverCaddie(admin(), id, 1);

    const vus = await listCaddiesForStarter(starter());
    expect(vus.map((c) => c.id)).not.toContain(id);
  });

  it("clot ses affectations en cours", async () => {
    // Sans cela, son nom s'afficherait au 18e trou sur le questionnaire d'un
    // client, pour un service qu'il n'a pas rendu.
    const id = await unCaddie();
    const cartId = await createCart(admin(), "V-1");
    const affId = await creerAffectation(admin(), {
      bookingRef: "RES-1",
      teeTime: new Date(),
      cartId,
      caddieId: id,
    });

    const closes = await archiverCaddie(admin(), id, 1);
    expect(closes).toBe(1);

    const [aff] = await db.select().from(assignment).where(eq(assignment.id, affId));
    expect(aff?.status).toBe("cancelled");
    expect(aff?.endedAt).not.toBeNull();
  });

  it("CONSERVE son historique d'evaluations", async () => {
    const id = await unCaddie();
    const cartId = await createCart(admin(), "V-2");
    const affId = await creerAffectation(admin(), {
      bookingRef: "RES-2",
      teeTime: new Date(),
      cartId,
      caddieId: id,
    });
    await soumettreEvaluation({
      golfCourseId: terrain,
      assignmentId: affId,
      langue: "fr",
      notes: { accueil: 5, experience_generale: 4 },
    });

    await archiverCaddie(admin(), id, 1);

    // Effacer le passe ferait bouger la moyenne du parcours a laquelle tous
    // les autres caddies sont compares (FR-042).
    const evals = await db.select().from(evaluation);
    expect(evals).toHaveLength(1);
    const [row] = await db.select().from(caddie).where(eq(caddie.id, id));
    expect(row).toBeDefined();
  });

  it("refuse un archivage portant une version perimee", async () => {
    const id = await unCaddie();
    await archiverCaddie(admin(), id, 1);
    await expect(archiverCaddie(admin(), id, 1)).rejects.toThrow();
  });

  it("est reserve a l'administrateur", async () => {
    const id = await unCaddie();
    await expect(archiverCaddie(starter(), id, 1)).rejects.toThrow();
  });
});
