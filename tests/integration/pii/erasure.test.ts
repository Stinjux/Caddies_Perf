import { describe, it, expect, beforeEach, afterAll } from "vitest";
import postgres from "postgres";
import { eq } from "drizzle-orm";
import { db } from "../../helpers/raw-db";
import { caddie, caddiePersonalData, auditLog } from "@/db/schema";
import { uuidv7 } from "@/lib/uuid";
import { readBirthYear, writeBirthYear, eraseBirthYear } from "@/server/pii";
import { testDbUrl, resetDb } from "../../helpers/reset-db";
import { testScope } from "../../helpers/scope";
import { makeCourse, makeAccount } from "../../helpers/fixtures";

/**
 * T075 / SCENARIO V-8 — EFFACEMENT SANS PERTE D'HISTORIQUE.
 *
 * L'exigence la plus delicate du produit : un caddie doit pouvoir faire
 * effacer ses renseignements personnels SANS que les statistiques du terrain
 * ne bougent d'un iota (FR-033, SC-009).
 *
 * Le test calcule les moyennes AVANT, efface, puis recalcule : elles doivent
 * etre STRICTEMENT identiques.
 */

const sql = postgres(testDbUrl(), { max: 1 });
afterAll(() => sql.end());

let courseId: string;
let adminId: string;
let caddieId: string;

const scope = () => testScope({ accountId: adminId, golfCourseId: courseId, role: "admin" });

/** Construit un historique complet : affectations terminees et evaluations. */
async function seedHistorique() {
  const cartId = uuidv7();
  const bookingIds = [uuidv7(), uuidv7()];

  await sql`INSERT INTO cart (id, golf_course_id, visible_number, qr_token)
            VALUES (${cartId}, ${courseId}, '12', ${"jeton-" + cartId})`;

  // Une valeur null represente une reponse « non applicable » (FR-043).
  const notes: (number | null)[][] = [
    [5, 4, 5, 3, 4, 5],
    [3, 3, 4, null, 5, 4],
  ];

  for (let i = 0; i < 2; i++) {
    const bookingId = bookingIds[i]!;
    const assignmentId = uuidv7();
    const evaluationId = uuidv7();

    await sql`INSERT INTO booking (id, golf_course_id, external_ref, tee_time, source)
              VALUES (${bookingId}, ${courseId}, ${"RES-" + i}, now(), 'manual')`;
    await sql`INSERT INTO assignment
                (id, golf_course_id, booking_id, cart_id, caddie_id, local_date, started_at,
                 ended_at, status, created_by_account_id)
              VALUES (${assignmentId}, ${courseId}, ${bookingId}, ${cartId}, ${caddieId},
                      CURRENT_DATE, now(), now(), 'completed', ${adminId})`;
    await sql`INSERT INTO evaluation
                (id, golf_course_id, assignment_id, language, comment, course_rating,
                 value_for_money, price_perception, comment_purge_at)
              VALUES (${evaluationId}, ${courseId}, ${assignmentId}, 'fr',
                      ${"Commentaire fictif " + i}, 4, 4, 'juste_et_raisonnable',
                      now() + interval '2 years')`;

    const criteres = [
      "accueil",
      "regles_etiquette",
      "connaissance_parcours",
      "lecture_verts",
      "communication",
      "experience_generale",
    ];
    for (let c = 0; c < criteres.length; c++) {
      await sql`INSERT INTO evaluation_criterion_answer (evaluation_id, criterion, rating)
                VALUES (${evaluationId}, ${criteres[c]!}::evaluation_criterion, ${notes[i]![c] ?? null})`;
    }
  }
}

/** Moyennes du caddie, calculees depuis les donnees de performance seules. */
async function moyennes() {
  const rows = await sql<{ criterion: string; moyenne: string; n: string }[]>`
    SELECT a.criterion, AVG(a.rating)::text AS moyenne, COUNT(a.rating)::text AS n
    FROM evaluation_criterion_answer a
    JOIN evaluation e ON e.id = a.evaluation_id
    JOIN assignment s ON s.id = e.assignment_id
    WHERE s.caddie_id = ${caddieId} AND a.rating IS NOT NULL
    GROUP BY a.criterion
    ORDER BY a.criterion
  `;
  return rows;
}

async function joursTravailles(): Promise<number> {
  const rows = await sql<{ n: string }[]>`
    SELECT COUNT(DISTINCT local_date)::text AS n FROM assignment
    WHERE caddie_id = ${caddieId} AND status = 'completed'
  `;
  return Number(rows[0]!.n);
}

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
  await db.insert(caddiePersonalData).values({ caddieId, birthYear: 1988 });
  await seedHistorique();
});

describe("V-8 — les statistiques survivent à l'effacement (SC-009)", () => {
  it("laisse les moyennes STRICTEMENT identiques", async () => {
    const avant = await moyennes();
    expect(avant.length).toBe(6);

    await eraseBirthYear(scope(), caddieId);

    expect(await moyennes()).toEqual(avant);
  });

  it("laisse le décompte des jours travaillés inchangé (FR-044)", async () => {
    const avant = await joursTravailles();
    expect(avant).toBe(1); // deux réservations le même jour ne comptent qu'une fois

    await eraseBirthYear(scope(), caddieId);

    expect(await joursTravailles()).toBe(avant);
  });

  it("conserve les affectations et les évaluations", async () => {
    const avant =
      await sql`SELECT count(*)::text AS n FROM assignment WHERE caddie_id = ${caddieId}`;
    await eraseBirthYear(scope(), caddieId);
    const apres =
      await sql`SELECT count(*)::text AS n FROM assignment WHERE caddie_id = ${caddieId}`;

    expect(apres).toEqual(avant);
    expect(Number(apres[0]!.n)).toBe(2);
  });

  it("conserve l'identité professionnelle du caddie", async () => {
    await eraseBirthYear(scope(), caddieId);

    const rows = await db.select().from(caddie).where(eq(caddie.id, caddieId));
    expect(rows).toHaveLength(1);
    expect(rows[0]?.internalRef).toBe("CED-001");
    expect(rows[0]?.firstName).toBe("Hassan");
  });
});

describe("l'effacement est réel et définitif", () => {
  it("ne laisse plus aucune année de naissance", async () => {
    expect(await readBirthYear(scope(), caddieId)).toBe(1988);

    await eraseBirthYear(scope(), caddieId);

    expect(await readBirthYear(scope(), caddieId)).toBeNull();
    const rows = await db
      .select()
      .from(caddiePersonalData)
      .where(eq(caddiePersonalData.caddieId, caddieId));
    expect(rows).toEqual([]);
  });

  it("est idempotent : un second effacement ne casse rien", async () => {
    await eraseBirthYear(scope(), caddieId);
    await expect(eraseBirthYear(scope(), caddieId)).resolves.toBeUndefined();
  });

  it("permet de ressaisir une valeur après effacement", async () => {
    await eraseBirthYear(scope(), caddieId);
    await writeBirthYear(scope(), caddieId, 1990);
    expect(await readBirthYear(scope(), caddieId)).toBe(1990);
  });

  it("journalise l'effacement sans consigner la valeur effacée", async () => {
    await eraseBirthYear(scope(), caddieId);

    const entries = await db.select().from(auditLog).where(eq(auditLog.action, "pii.erase"));
    expect(entries).toHaveLength(1);
    expect(JSON.stringify(entries)).not.toContain("1988");
  });
});
