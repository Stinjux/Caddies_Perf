import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { champsMetier } from "../helpers/champs-metier";
import postgres from "postgres";
import { eq } from "drizzle-orm";
import { db } from "../helpers/raw-db";
import { caddie, caddiePersonalData, evaluation, auditLog } from "@/db/schema";
import { uuidv7 } from "@/lib/uuid";
import {
  runRetentionPurge,
  commentPurgeDate,
  RETENTION_YEARS_COMMENT,
} from "@/server/jobs/retention";
import { testDbUrl, resetDb } from "../helpers/reset-db";
import { makeCourse, makeAccount } from "../helpers/fixtures";

/**
 * T076 — PURGE A ECHEANCE (FR-034, FR-034b, FR-034c).
 *
 * Le piege a eviter : une purge naive supprimerait la ligne d'evaluation avec
 * son commentaire, et les statistiques historiques du terrain s'effaceraient
 * d'elles-memes au bout de deux ans. Ici, seul le TEXTE est vide.
 */

const sql = postgres(testDbUrl(), { max: 1 });
afterAll(() => sql.end());

let courseId: string;
let adminId: string;

beforeEach(async () => {
  await resetDb();
  courseId = await makeCourse("Golf des Cèdres");
  adminId = await makeAccount({ links: [{ courseId, role: "admin" }] });
});

async function seedEvaluation(opts: { comment: string; purgeAt: Date }) {
  const caddieId = uuidv7();
  const cartId = uuidv7();
  const bookingId = uuidv7();
  const assignmentId = uuidv7();
  const evaluationId = uuidv7();

  await db.insert(caddie).values({
    id: caddieId,
    golfCourseId: courseId,
    internalRef: "CED-" + caddieId.slice(0, 4),
    firstName: "Prenom",
    lastName: "Fictif",
  });
  await sql`INSERT INTO cart (id, golf_course_id, visible_number, qr_token)
            VALUES (${cartId}, ${courseId}, ${cartId.slice(0, 4)}, ${"jeton-" + cartId})`;
  await sql`INSERT INTO booking (id, golf_course_id, external_ref, tee_time, source)
            VALUES (${bookingId}, ${courseId}, ${"RES-" + bookingId.slice(0, 4)}, now(), 'manual')`;
  await sql`INSERT INTO assignment
              (id, golf_course_id, booking_id, cart_id, caddie_id, local_date, started_at,
               ended_at, status, created_by_account_id)
            VALUES (${assignmentId}, ${courseId}, ${bookingId}, ${cartId}, ${caddieId},
                    CURRENT_DATE, now(), now(), 'completed', ${adminId})`;
  await sql`INSERT INTO evaluation
              (id, golf_course_id, assignment_id, language, comment, course_rating,
               value_for_money, price_perception, comment_purge_at)
            VALUES (${evaluationId}, ${courseId}, ${assignmentId}, 'fr', ${opts.comment},
                    4, 5, 'juste_et_raisonnable', ${opts.purgeAt})`;
  await sql`INSERT INTO evaluation_criterion_answer (evaluation_id, criterion, rating)
            VALUES (${evaluationId}, 'accueil', 5)`;

  return { caddieId, evaluationId };
}

describe("purge des commentaires (FR-034c)", () => {
  it("vide un commentaire arrivé à échéance", async () => {
    const { evaluationId } = await seedEvaluation({
      comment: "Commentaire fictif arrivé à échéance",
      purgeAt: new Date(Date.now() - 86_400_000),
    });

    const rapport = await runRetentionPurge(adminId);
    expect(rapport.commentsCleared).toBe(1);

    const rows = await db.select().from(evaluation).where(eq(evaluation.id, evaluationId));
    expect(rows[0]?.comment).toBeNull();
  });

  it("CONSERVE la ligne d'évaluation et ses notes chiffrées", async () => {
    const { evaluationId } = await seedEvaluation({
      comment: "Commentaire fictif",
      purgeAt: new Date(Date.now() - 86_400_000),
    });

    await runRetentionPurge(adminId);

    const rows = await db.select().from(evaluation).where(eq(evaluation.id, evaluationId));
    expect(rows).toHaveLength(1);
    expect(rows[0]?.courseRating).toBe(4);
    expect(rows[0]?.valueForMoney).toBe(5);

    const notes = await sql`SELECT rating FROM evaluation_criterion_answer
                            WHERE evaluation_id = ${evaluationId}`;
    expect(notes).toHaveLength(1);
    expect(notes[0]!.rating).toBe(5);
  });

  it("épargne un commentaire pas encore arrivé à échéance", async () => {
    const { evaluationId } = await seedEvaluation({
      comment: "Commentaire fictif récent",
      purgeAt: new Date(Date.now() + 86_400_000),
    });

    const rapport = await runRetentionPurge(adminId);
    expect(rapport.commentsCleared).toBe(0);

    const rows = await db.select().from(evaluation).where(eq(evaluation.id, evaluationId));
    expect(rows[0]?.comment).toBe("Commentaire fictif récent");
  });

  it("est idempotent : un second passage ne vide rien de plus", async () => {
    await seedEvaluation({
      comment: "Commentaire fictif",
      purgeAt: new Date(Date.now() - 86_400_000),
    });

    expect((await runRetentionPurge(adminId)).commentsCleared).toBe(1);
    expect((await runRetentionPurge(adminId)).commentsCleared).toBe(0);
  });
});

describe("purge des années de naissance (FR-034)", () => {
  it("efface celle d'un caddie désactivé depuis plus de deux ans", async () => {
    const caddieId = uuidv7();
    const vieux = new Date();
    vieux.setFullYear(vieux.getFullYear() - 3);

    await db.insert(caddie).values({
      id: caddieId,
      golfCourseId: courseId,
      internalRef: "CED-VIEUX",
      firstName: "Prenom",
      lastName: "Fictif",
      status: "disabled",
      updatedAt: vieux,
    });
    await db.insert(caddiePersonalData).values({ caddieId, birthYear: 1975 });

    const rapport = await runRetentionPurge(adminId);
    expect(rapport.birthYearsErased).toBe(1);

    const rows = await db
      .select()
      .from(caddiePersonalData)
      .where(eq(caddiePersonalData.caddieId, caddieId));
    expect(rows).toEqual([]);
  });

  it("épargne un caddie ACTIF, même très ancien", async () => {
    const caddieId = uuidv7();
    const vieux = new Date();
    vieux.setFullYear(vieux.getFullYear() - 10);

    await db.insert(caddie).values({
      id: caddieId,
      golfCourseId: courseId,
      internalRef: "CED-ACTIF",
      firstName: "Prenom",
      lastName: "Fictif",
      status: "active",
      updatedAt: vieux,
    });
    await db.insert(caddiePersonalData).values({ caddieId, birthYear: 1975 });

    expect((await runRetentionPurge(adminId)).birthYearsErased).toBe(0);
  });

  it("épargne un caddie désactivé depuis moins de deux ans", async () => {
    const caddieId = uuidv7();
    const recent = new Date();
    recent.setMonth(recent.getMonth() - 6);

    await db.insert(caddie).values({
      id: caddieId,
      golfCourseId: courseId,
      internalRef: "CED-RECENT",
      firstName: "Prenom",
      lastName: "Fictif",
      status: "disabled",
      updatedAt: recent,
    });
    await db.insert(caddiePersonalData).values({ caddieId, birthYear: 1975 });

    expect((await runRetentionPurge(adminId)).birthYearsErased).toBe(0);
  });

  it("conserve le caddie et son historique après purge (FR-042)", async () => {
    const caddieId = uuidv7();
    const vieux = new Date();
    vieux.setFullYear(vieux.getFullYear() - 3);

    await db.insert(caddie).values({
      id: caddieId,
      golfCourseId: courseId,
      internalRef: "CED-HIST",
      firstName: "Prenom",
      lastName: "Fictif",
      status: "disabled",
      updatedAt: vieux,
    });
    await db.insert(caddiePersonalData).values({ caddieId, birthYear: 1975 });

    await runRetentionPurge(adminId);

    const rows = await db.select().from(caddie).where(eq(caddie.id, caddieId));
    expect(rows).toHaveLength(1);
    expect(rows[0]?.internalRef).toBe("CED-HIST");
  });

  it("journalise la purge sans consigner la valeur effacée (FR-037)", async () => {
    const caddieId = uuidv7();
    const vieux = new Date();
    vieux.setFullYear(vieux.getFullYear() - 3);

    await db.insert(caddie).values({
      id: caddieId,
      golfCourseId: courseId,
      internalRef: "CED-JOURNAL",
      firstName: "Prenom",
      lastName: "Fictif",
      status: "disabled",
      updatedAt: vieux,
    });
    await db.insert(caddiePersonalData).values({ caddieId, birthYear: 1975 });

    await runRetentionPurge(adminId);

    const entries = await db.select().from(auditLog).where(eq(auditLog.action, "retention.purge"));
    expect(entries).toHaveLength(1);
    expect(champsMetier(entries)).not.toContain("1975");
  });
});

describe("calcul de l'échéance", () => {
  it("fixe la purge d'un commentaire à deux ans après son dépôt", () => {
    const depot = new Date("2026-09-18T12:00:00Z");
    const echeance = commentPurgeDate(depot);
    expect(echeance.getFullYear()).toBe(depot.getFullYear() + RETENTION_YEARS_COMMENT);
  });
});
