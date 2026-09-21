import { describe, it, expect, afterAll } from "vitest";
import postgres from "postgres";
import { testDbUrl } from "../../helpers/reset-db";

/**
 * Scenario V-5 — le schema REFUSE les donnees interdites.
 *
 * Garde-fou permanent du principe I. Ce test ne verifie pas que l'application
 * evite de stocker ces donnees : il verifie que la base en est structurellement
 * incapable (FR-028, FR-028b).
 */

const sql = postgres(testDbUrl(), { max: 1 });
afterAll(() => sql.end());

describe("V-5 — le schema est incapable de recevoir des donnees interdites", () => {
  it("n'expose aucune colonne de taille d'habits, d'adresse de domicile, d'age ou de force", async () => {
    const rows = await sql<{ table_name: string; column_name: string }[]>`
      SELECT table_name, column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND (
          column_name ILIKE '%clothing%' OR column_name ILIKE '%taille%'
          OR column_name ILIKE '%strength%' OR column_name ILIKE '%force%'
          OR column_name = 'age' OR column_name ILIKE '%home_address%'
          OR column_name ILIKE '%birth_date%' OR column_name ILIKE '%date_of_birth%'
        )
    `;
    expect(rows).toEqual([]);
  });

  it("limite la table caddie aux seuls champs professionnels", async () => {
    const rows = await sql<{ column_name: string }[]>`
      SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'caddie'
      ORDER BY column_name
    `;
    expect(rows.map((r) => r.column_name)).toEqual([
      "availability",
      "created_at",
      "first_name",
      "golf_course_id",
      "id",
      "internal_ref",
      "last_name",
      "seniority_recorded_on",
      "seniority_years",
      "status",
      "updated_at",
      "version",
    ]);
  });

  it("limite les renseignements personnels a la seule annee de naissance", async () => {
    const rows = await sql<{ column_name: string }[]>`
      SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'caddie_personal_data'
      ORDER BY column_name
    `;
    expect(rows.map((r) => r.column_name)).toEqual(["birth_year", "caddie_id", "updated_at"]);
  });

  it("refuse une annee de naissance hors bornes", async () => {
    await expect(
      sql`INSERT INTO caddie_personal_data (caddie_id, birth_year)
          VALUES (gen_random_uuid(), 1800)`,
    ).rejects.toThrow();
  });
});

describe("V-3 — cloisonnement garanti par la base", () => {
  it("impose une cle etrangere composite par parcours sur le lien evaluation-caddie", async () => {
    const rows = await sql<{ conname: string }[]>`
      SELECT conname FROM pg_constraint
      WHERE contype = 'f' AND conname LIKE '%same_course%'
      ORDER BY conname
    `;
    expect(rows.map((r) => r.conname)).toEqual([
      // Un seul lien subsiste : l'evaluation designe le caddie. Voiturettes,
      // affectations et reservations ont disparu avec le QR par voiturette.
      "fk_evaluation_caddie_same_course",
    ]);
  });
});

describe("FR-038 — le journal est en ecriture seule", () => {
  it("n'accorde que INSERT et SELECT au role applicatif", async () => {
    const rows = await sql<{ privilege_type: string }[]>`
      SELECT privilege_type FROM information_schema.table_privileges
      WHERE grantee = 'caddieperf_app' AND table_name = 'audit_log'
      ORDER BY privilege_type
    `;
    expect(rows.map((r) => r.privilege_type)).toEqual(["INSERT", "SELECT"]);
  });
});
