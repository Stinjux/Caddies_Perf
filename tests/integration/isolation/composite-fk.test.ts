import { describe, it, expect, beforeEach, afterAll } from "vitest";
import postgres from "postgres";
import { testDbUrl, resetDb } from "../../helpers/reset-db";
import { makeCourse } from "../../helpers/fixtures";

/**
 * T056 — LE CLOISONNEMENT EST GARANTI PAR LA BASE (FR-026).
 *
 * Ces tests court-circuitent TOUTE la couche applicative et ecrivent
 * directement en SQL. Si le cloisonnement ne tenait qu'a du code, ils
 * passeraient. Ils echouent — c'est le but : PostgreSQL lui-meme refuse.
 *
 * Le modele s'est reduit : un QR par parcours, plus de voiturettes ni
 * d'affectations. Il ne reste qu'un lien operationnel, evaluation → caddie,
 * et c'est celui-la qui doit etre infranchissable.
 */

const sql = postgres(testDbUrl(), { max: 1 });
afterAll(() => sql.end());

let cedres: string;
let atlas: string;

beforeEach(async () => {
  await resetDb();
  cedres = await makeCourse("Golf des Cèdres");
  atlas = await makeCourse("Royal Atlas");
});

async function unCaddie(courseId: string, ref: string): Promise<string> {
  const id = crypto.randomUUID();
  await sql`INSERT INTO caddie (id, golf_course_id, internal_ref, first_name, last_name)
            VALUES (${id}, ${courseId}, ${ref}, 'Prenom', 'Fictif')`;
  return id;
}

async function insererEvaluation(courseId: string, caddieId: string) {
  return sql`INSERT INTO evaluation
               (id, golf_course_id, caddie_id, language, comment_purge_at)
             VALUES (${crypto.randomUUID()}, ${courseId}, ${caddieId}, 'fr',
                     now() + interval '2 years')`;
}

describe("une évaluation ne peut pas désigner le caddie d'un autre parcours", () => {
  it("accepte une évaluation cohérente", async () => {
    const caddie = await unCaddie(cedres, "REF-A");
    await expect(insererEvaluation(cedres, caddie)).resolves.toBeDefined();
  });

  it("REFUSE un caddie appartenant à un autre parcours", async () => {
    // Le caddie existe, le parcours aussi : seul le COUPLE est incohérent.
    // Une clé étrangère simple laisserait passer ; la clé composite non.
    const caddieAtlas = await unCaddie(atlas, "REF-B");
    await expect(insererEvaluation(cedres, caddieAtlas)).rejects.toThrow(
      /fk_evaluation_caddie_same_course|violates foreign key/i,
    );
  });

  it("REFUSE de déplacer après coup une évaluation vers un autre parcours", async () => {
    const caddie = await unCaddie(cedres, "REF-A");
    await insererEvaluation(cedres, caddie);

    await expect(
      sql`UPDATE evaluation SET golf_course_id = ${atlas} WHERE caddie_id = ${caddie}`,
    ).rejects.toThrow(/violates foreign key/i);
  });
});

describe("le jeton du QR identifie UN parcours", () => {
  it("refuse le même jeton sur deux parcours", async () => {
    const [jeton] = await sql<{ qr_token: string }[]>`
      SELECT qr_token FROM golf_course WHERE id = ${cedres}
    `;
    await expect(
      sql`UPDATE golf_course SET qr_token = ${jeton!.qr_token} WHERE id = ${atlas}`,
    ).rejects.toThrow(/uq_golf_course_qr_token|duplicate key/i);
  });
});
