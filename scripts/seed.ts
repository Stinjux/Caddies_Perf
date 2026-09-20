import { config } from "dotenv";
config({ path: ".env", quiet: true });

import postgres from "postgres";
import { randomBytes, scrypt, type ScryptOptions } from "node:crypto";
import { courses, accounts } from "../fixtures/seed-data.ts";

/**
 * Amorce la base de DEVELOPPEMENT avec le jeu FICTIF (principe II).
 * Aucune donnee reelle. A ne jamais executer en production.
 *
 * Volontairement autonome : ce script n'importe pas src/, afin de rester
 * executable par Node sans couche de resolution d'alias.
 */

const PARAMS: ScryptOptions = { N: 16384, r: 8, p: 1 };

function hash(password: string): Promise<string> {
  const salt = randomBytes(16);
  return new Promise((resolve, reject) => {
    scrypt(password, salt, 64, PARAMS, (err, derived) =>
      err
        ? reject(err)
        : resolve(
            `scrypt$${PARAMS.N}$${PARAMS.r}$${PARAMS.p}$${salt.toString("base64")}$${derived.toString("base64")}`,
          ),
    );
  });
}

function uuidv7(now = Date.now()): string {
  const b = randomBytes(16);
  b[0] = (now / 2 ** 40) & 0xff;
  b[1] = (now / 2 ** 32) & 0xff;
  b[2] = (now / 2 ** 24) & 0xff;
  b[3] = (now / 2 ** 16) & 0xff;
  b[4] = (now / 2 ** 8) & 0xff;
  b[5] = now & 0xff;
  b[6] = (b[6]! & 0x0f) | 0x70;
  b[8] = (b[8]! & 0x3f) | 0x80;
  const h = b.toString("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL est absente.");
if (url.includes("_test")) throw new Error("Refus d'amorcer la base de test.");

const sql = postgres(url, { max: 1 });

const ids = new Map<string, string>();

for (const c of courses) {
  const id = uuidv7();
  ids.set(c.key, id);
  await sql`
    INSERT INTO golf_course (id, name, address, timezone, qr_token, brand_color_primary, brand_color_secondary, google_review_url)
    VALUES (${id}, ${c.name}, ${c.address}, ${c.timezone}, ${randomBytes(32).toString("base64url")},
            ${c.brandColorPrimary}, ${c.brandColorSecondary}, ${c.googleReviewUrl})
    ON CONFLICT DO NOTHING
  `;
}

for (const a of accounts) {
  const id = uuidv7();
  // Les administrateurs sont inscrits d'office au second facteur, avec un
  // secret FICTIF partage : sans cela, le premier ecran apres connexion serait
  // toujours celui de l'inscription, et les essais deviendraient penibles.
  const secret = "totpSecret" in a ? (a.totpSecret as string) : null;
  await sql`
    INSERT INTO account (id, email, first_name, last_name, password_hash, totp_secret, totp_enrolled_at)
    VALUES (${id}, ${a.email}, ${a.firstName}, ${a.lastName}, ${await hash(a.password)},
            ${secret}, ${secret ? new Date() : null})
    ON CONFLICT (email) DO NOTHING
  `;
  for (const l of a.links) {
    await sql`
      INSERT INTO account_golf_course (account_id, golf_course_id, role)
      VALUES (${id}, ${ids.get(l.course)!}, ${l.role})
      ON CONFLICT DO NOTHING
    `;
  }
  console.log(`  ${a.email}  /  ${a.password}`);
}

console.log(`\n${courses.length} terrains et ${accounts.length} comptes fictifs amorcés.`);
await sql.end();
