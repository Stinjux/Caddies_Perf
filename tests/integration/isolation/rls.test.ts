import { describe, it, expect, beforeAll, afterAll } from "vitest";
import postgres from "postgres";
import { resetDb } from "../../helpers/reset-db";
import { makeCourse } from "../../helpers/fixtures";
import { db } from "../../helpers/raw-db";
import { caddie, caddiePersonalData } from "@/db/schema";
import { uuidv7 } from "@/lib/uuid";

/**
 * FR-023b — LE MOTEUR REFUSE DE RENDRE LA LIGNE D'UN AUTRE PARCOURS.
 *
 * Ce fichier n'appelle AUCUN code applicatif. Il se connecte directement en
 * SQL avec le role de production et ecrit des requetes SANS clause de parcours
 * — exactement la faute que le RLS doit rattraper. Si ces requetes rendaient
 * quoi que ce soit, le cloisonnement ne tiendrait qu'a la vigilance des
 * developpeurs, ce qui n'est pas une garantie.
 *
 * Toutes les ecritures ci-dessous visent la base de TEST, dont le contenu est
 * fictif et recree a chaque serie.
 */

const urlApp = process.env.TEST_APP_DATABASE_URL;
if (!urlApp) {
  throw new Error(
    "TEST_APP_DATABASE_URL est absente : le RLS ne peut pas etre verifie. Voir .env.example.",
  );
}

const app = postgres(urlApp, { max: 1 });

let parcoursA = "";
let parcoursB = "";
let caddieA = "";
let caddieB = "";

beforeAll(async () => {
  await resetDb();
  parcoursA = await makeCourse("Parcours Fictif A");
  parcoursB = await makeCourse("Parcours Fictif B");
  caddieA = uuidv7();
  caddieB = uuidv7();
  await db.insert(caddie).values([
    {
      id: caddieA,
      golfCourseId: parcoursA,
      internalRef: "A-001",
      firstName: "Amine",
      lastName: "Fictif",
    },
    {
      id: caddieB,
      golfCourseId: parcoursB,
      internalRef: "B-001",
      firstName: "Brahim",
      lastName: "Fictif",
    },
  ]);
  await db.insert(caddiePersonalData).values([
    { caddieId: caddieA, birthYear: 1990 },
    { caddieId: caddieB, birthYear: 1991 },
  ]);
});

afterAll(() => app.end());

/** Ouvre une transaction en annoncant — ou non — un parcours courant. */
async function commeApplication<T>(
  golfCourseId: string | null,
  fn: (tx: postgres.TransactionSql) => Promise<T>,
): Promise<T> {
  return app.begin(async (tx) => {
    if (golfCourseId) await tx`SELECT set_config('app.golf_course_id', ${golfCourseId}, true)`;
    return fn(tx);
  }) as Promise<T>;
}

describe("le role applicatif ne peut pas contourner le RLS", () => {
  it("n'est ni superutilisateur ni dispense de RLS", async () => {
    // Sans cette verification, tout le reste du fichier pourrait passer au
    // vert sur une base ou le RLS n'est simplement jamais evalue.
    const [r] = await app<{ super: boolean; bypass: boolean }[]>`
      SELECT rolsuper AS super, rolbypassrls AS bypass
      FROM pg_roles WHERE rolname = current_user`;
    expect(r?.super).toBe(false);
    expect(r?.bypass).toBe(false);
  });

  it("n'est pas proprietaire des tables, et subit donc FORCE ROW LEVEL SECURITY", async () => {
    const [r] = await app<{ proprietaire: boolean }[]>`
      SELECT tableowner = current_user AS proprietaire
      FROM pg_tables WHERE schemaname = 'public' AND tablename = 'caddie'`;
    expect(r?.proprietaire).toBe(false);
  });
});

describe("une requete SANS clause de parcours", () => {
  it("ne rend AUCUN caddie quand aucun parcours n'est annonce", async () => {
    const rows = await commeApplication(null, (tx) => tx`SELECT id FROM caddie`);
    expect(rows).toHaveLength(0);
  });

  it("ne rend que le parcours annonce, meme sans WHERE", async () => {
    const rows = await commeApplication(
      parcoursA,
      (tx) => tx<{ id: string }[]>`SELECT id FROM caddie`,
    );
    expect(rows.map((r) => r.id)).toEqual([caddieA]);
  });

  it("ne rend pas un caddie de l'autre parcours meme nomme par son identifiant", async () => {
    const rows = await commeApplication(
      parcoursA,
      (tx) => tx`SELECT id FROM caddie WHERE id = ${caddieB}`,
    );
    expect(rows).toHaveLength(0);
  });

  it("cloisonne l'annee de naissance par le parcours de son caddie", async () => {
    const rows = await commeApplication(
      parcoursA,
      (tx) => tx<{ caddie_id: string }[]>`SELECT caddie_id FROM caddie_personal_data`,
    );
    expect(rows.map((r) => r.caddie_id)).toEqual([caddieA]);
  });
});

describe("une ecriture visant un autre parcours", () => {
  it("refuse d'inserer une ligne rattachee a un autre parcours", async () => {
    await expect(
      commeApplication(
        parcoursA,
        (tx) => tx`INSERT INTO caddie (id, golf_course_id, internal_ref, first_name, last_name)
                   VALUES (gen_random_uuid(), ${parcoursB}, 'X-999', 'Intrus', 'Fictif')`,
      ),
    ).rejects.toThrow(/row-level security/i);
  });

  it("n'atteint aucune ligne de l'autre parcours en modifiant sans WHERE", async () => {
    await commeApplication(parcoursA, (tx) => tx`UPDATE caddie SET first_name = 'Ecrase'`);

    const parId = new Map((await db.select().from(caddie)).map((c) => [c.id, c.firstName]));
    expect(parId.get(caddieB)).toBe("Brahim");
    expect(parId.get(caddieA)).toBe("Ecrase");
  });

  it("n'efface rien chez l'autre parcours avec une suppression sans WHERE", async () => {
    await commeApplication(parcoursA, async (tx) => {
      // La table fille d'abord, sinon la cle etrangere refuse avant meme que
      // le RLS ait son mot a dire. Elle aussi est sans WHERE : c'est le sujet.
      await tx`DELETE FROM caddie_personal_data`;
      await tx`DELETE FROM caddie`;
    });

    const restants = await db.select().from(caddie);
    expect(restants.map((c) => c.id)).toEqual([caddieB]);

    // L'annee de naissance du parcours B a survecu a une suppression totale
    // lancee depuis le parcours A.
    const pii = await db.select().from(caddiePersonalData);
    expect(pii.map((p) => p.caddieId)).toEqual([caddieB]);
  });
});
