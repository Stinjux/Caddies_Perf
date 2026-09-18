import { describe, it, expect, beforeEach, afterAll } from "vitest";
import postgres from "postgres";
import { testDbUrl, resetDb } from "../../helpers/reset-db";
import { makeCourse, makeAccount } from "../../helpers/fixtures";

/**
 * T056 — LE CLOISONNEMENT EST GARANTI PAR LA BASE (FR-026).
 *
 * Ces tests court-circuitent TOUTE la couche applicative et ecrivent
 * directement en SQL. Si le cloisonnement ne tenait qu'a du code, ils
 * passeraient. Ils echouent — c'est le but : PostgreSQL lui-meme refuse.
 */

const sql = postgres(testDbUrl(), { max: 1 });
afterAll(() => sql.end());

let cedres: string;
let atlas: string;
let auteur: string;

beforeEach(async () => {
  await resetDb();
  cedres = await makeCourse("Golf des Cèdres");
  atlas = await makeCourse("Royal Atlas");
  auteur = await makeAccount({ links: [{ courseId: cedres, role: "admin" }] });
});

async function seedOperational(courseId: string, suffix: string) {
  const caddieId = crypto.randomUUID();
  const cartId = crypto.randomUUID();
  const bookingId = crypto.randomUUID();

  await sql`INSERT INTO caddie (id, golf_course_id, internal_ref, first_name, last_name)
            VALUES (${caddieId}, ${courseId}, ${"REF-" + suffix}, 'Prenom', 'Fictif')`;
  await sql`INSERT INTO cart (id, golf_course_id, visible_number, qr_token)
            VALUES (${cartId}, ${courseId}, ${"N" + suffix}, ${"jeton-" + suffix})`;
  await sql`INSERT INTO booking (id, golf_course_id, external_ref, tee_time, source)
            VALUES (${bookingId}, ${courseId}, ${"RES-" + suffix}, now(), 'manual')`;

  return { caddieId, cartId, bookingId };
}

describe("une affectation ne peut pas relier deux terrains", () => {
  it("accepte une affectation entièrement cohérente", async () => {
    const { caddieId, cartId, bookingId } = await seedOperational(cedres, "ok");

    await expect(
      sql`INSERT INTO assignment
            (id, golf_course_id, booking_id, cart_id, caddie_id, local_date, started_at, created_by_account_id)
          VALUES (${crypto.randomUUID()}, ${cedres}, ${bookingId}, ${cartId}, ${caddieId},
                  CURRENT_DATE, now(), ${auteur})`,
    ).resolves.toBeDefined();
  });

  it("REFUSE un caddie appartenant à un autre terrain", async () => {
    const mien = await seedOperational(cedres, "a");
    const voisin = await seedOperational(atlas, "b");

    await expect(
      sql`INSERT INTO assignment
            (id, golf_course_id, booking_id, cart_id, caddie_id, local_date, started_at, created_by_account_id)
          VALUES (${crypto.randomUUID()}, ${cedres}, ${mien.bookingId}, ${mien.cartId}, ${voisin.caddieId},
                  CURRENT_DATE, now(), ${auteur})`,
    ).rejects.toThrow(/fk_assignment_caddie_same_course/);
  });

  it("REFUSE une voiturette appartenant à un autre terrain", async () => {
    const mien = await seedOperational(cedres, "c");
    const voisin = await seedOperational(atlas, "d");

    await expect(
      sql`INSERT INTO assignment
            (id, golf_course_id, booking_id, cart_id, caddie_id, local_date, started_at, created_by_account_id)
          VALUES (${crypto.randomUUID()}, ${cedres}, ${mien.bookingId}, ${voisin.cartId}, ${mien.caddieId},
                  CURRENT_DATE, now(), ${auteur})`,
    ).rejects.toThrow(/fk_assignment_cart_same_course/);
  });

  it("REFUSE une réservation appartenant à un autre terrain", async () => {
    const mien = await seedOperational(cedres, "e");
    const voisin = await seedOperational(atlas, "f");

    await expect(
      sql`INSERT INTO assignment
            (id, golf_course_id, booking_id, cart_id, caddie_id, local_date, started_at, created_by_account_id)
          VALUES (${crypto.randomUUID()}, ${cedres}, ${voisin.bookingId}, ${mien.cartId}, ${mien.caddieId},
                  CURRENT_DATE, now(), ${auteur})`,
    ).rejects.toThrow(/fk_assignment_booking_same_course/);
  });
});

describe("unicité de l'identifiant interne d'un caddie (FR-041)", () => {
  it("refuse deux caddies de même référence sur un même terrain", async () => {
    await sql`INSERT INTO caddie (id, golf_course_id, internal_ref, first_name, last_name)
              VALUES (${crypto.randomUUID()}, ${cedres}, 'CED-001', 'Prenom', 'Fictif')`;

    await expect(
      sql`INSERT INTO caddie (id, golf_course_id, internal_ref, first_name, last_name)
          VALUES (${crypto.randomUUID()}, ${cedres}, 'CED-001', 'Autre', 'Fictif')`,
    ).rejects.toThrow(/uq_caddie_course_ref/);
  });

  it("autorise la même référence sur deux terrains distincts", async () => {
    await sql`INSERT INTO caddie (id, golf_course_id, internal_ref, first_name, last_name)
              VALUES (${crypto.randomUUID()}, ${cedres}, 'REF-001', 'Prenom', 'Fictif')`;

    await expect(
      sql`INSERT INTO caddie (id, golf_course_id, internal_ref, first_name, last_name)
          VALUES (${crypto.randomUUID()}, ${atlas}, 'REF-001', 'Prenom', 'Fictif')`,
    ).resolves.toBeDefined();
  });
});

describe("unicité globale du jeton de QR code (FR-031)", () => {
  it("refuse le même jeton sur deux terrains", async () => {
    await sql`INSERT INTO cart (id, golf_course_id, visible_number, qr_token)
              VALUES (${crypto.randomUUID()}, ${cedres}, '1', 'jeton-partage')`;

    await expect(
      sql`INSERT INTO cart (id, golf_course_id, visible_number, qr_token)
          VALUES (${crypto.randomUUID()}, ${atlas}, '1', 'jeton-partage')`,
    ).rejects.toThrow(/qr_token/);
  });
});
