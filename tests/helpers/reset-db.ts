import postgres from "postgres";

/**
 * Reinitialise la base de TEST entre les series.
 *
 * Vide les tables sans toucher au schema : plus rapide qu'un rejeu complet
 * des migrations, et sans risque de divergence.
 *
 * SECURITE : cette fonction lit TEST_DATABASE_URL, jamais DATABASE_URL, et
 * refuse toute base dont le nom ne se termine pas par "_test".
 */

const TABLES = [
  "google_review_click",
  "evaluation_criterion_answer",
  "evaluation",
  "caddie_personal_data",
  "caddie",
  "session",
  "account_golf_course",
  "audit_log",
  "account",
  "golf_course",
];

export function testDbUrl(): string {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) throw new Error("TEST_DATABASE_URL est absente. Voir .env.example.");

  const name = new URL(url).pathname.replace(/^\//, "");
  if (!name.endsWith("_test")) {
    throw new Error(
      `Refus d'opérer sur la base "${name}" : seule une base suffixée par _test est acceptée.`,
    );
  }
  return url;
}

export async function resetDb(): Promise<void> {
  const sql = postgres(testDbUrl(), { max: 1 });
  try {
    const list = TABLES.map((t) => `"${t}"`).join(", ");
    await sql.unsafe(`TRUNCATE TABLE ${list} CASCADE`);
  } finally {
    await sql.end();
  }
}
