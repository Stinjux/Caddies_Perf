import { describe, it, expect, beforeEach } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "../helpers/raw-db";
import { resetDb } from "../helpers/reset-db";
import { makeCourse, makeAccount, PASSWORD } from "../helpers/fixtures";
import { account, session } from "@/db/schema";
import { login, resolveSession } from "@/server/auth/current";
import {
  preparerInscription,
  confirmerInscription,
  verifierSecondFacteur,
  secondFacteurActif,
  retirerSecondFacteur,
  codesDeSecoursRestants,
} from "@/server/auth/mfa";
import { codeActuel } from "@/lib/totp";

/**
 * SECOND FACTEUR — PARCOURS COMPLET.
 *
 * Le point le plus delicat n'est pas la cryptographie : c'est l'etat
 * intermediaire. Entre « mot de passe verifie » et « code verifie », il
 * existe une session qui ne doit RIEN autoriser. Une erreur a cet endroit
 * transformerait le second facteur en simple formalite.
 */

let terrain = "";
const EMAIL = "admin.mfa@example.invalid";

async function unAdmin(): Promise<string> {
  return makeAccount({ email: EMAIL, links: [{ courseId: terrain, role: "admin" }] });
}

async function inscrire(accountId: string): Promise<{ secret: string; codes: string[] }> {
  const { secret } = await preparerInscription(accountId);
  const codes = await confirmerInscription(accountId, codeActuel(secret));
  return { secret, codes };
}

beforeEach(async () => {
  await resetDb();
  terrain = await makeCourse("Golf Fictif du Second Facteur");
});

describe("inscription", () => {
  it("ne protege PAS le compte tant que l'inscription n'est pas confirmee", async () => {
    // Un secret impose avant que l'utilisateur ait reussi a l'enregistrer
    // dans son telephone l'enfermerait dehors.
    const id = await unAdmin();
    await preparerInscription(id);

    expect(await secondFacteurActif(id)).toBe(false);
    const { secondFacteurRequis } = await login(EMAIL, PASSWORD);
    expect(secondFacteurRequis).toBe(false);
  });

  it("REUTILISE le secret en attente d'un affichage a l'autre", async () => {
    // Defaut trouve en essayant l'ecran dans un navigateur : chaque affichage
    // tirait un nouveau secret. L'utilisateur scannait le premier, la page se
    // reaffichait, et son code ne correspondait plus a rien. Personne n'aurait
    // jamais pu terminer une inscription.
    const id = await unAdmin();
    const premier = await preparerInscription(id);
    const second = await preparerInscription(id);
    expect(second.secret).toBe(premier.secret);

    // Et le code du secret affiche en premier reste valable.
    await expect(confirmerInscription(id, codeActuel(premier.secret))).resolves.toHaveLength(8);
  });

  it("refuse la confirmation sur un code faux", async () => {
    const id = await unAdmin();
    await preparerInscription(id);
    await expect(confirmerInscription(id, "000000")).rejects.toThrow(/Code incorrect/);
    expect(await secondFacteurActif(id)).toBe(false);
  });

  it("active le second facteur et remet huit codes de secours", async () => {
    const id = await unAdmin();
    const { codes } = await inscrire(id);

    expect(codes).toHaveLength(8);
    expect(await secondFacteurActif(id)).toBe(true);
    expect(await codesDeSecoursRestants(id)).toBe(8);
  });

  it("ne conserve JAMAIS les codes de secours en clair", async () => {
    const id = await unAdmin();
    const { codes } = await inscrire(id);

    const [row] = await db.select().from(account).where(eq(account.id, id));
    const stockes = JSON.stringify(row?.recoveryCodes);
    for (const c of codes) expect(stockes).not.toContain(c);
    // Ce sont des haches scrypt, comme les mots de passe.
    for (const h of row!.recoveryCodes!) expect(h).toMatch(/^scrypt\$/);
  });

  it("refuse une seconde inscription sur un compte deja protege", async () => {
    const id = await unAdmin();
    await inscrire(id);
    await expect(preparerInscription(id)).rejects.toThrow(/déjà en place/);
  });
});

describe("la session en attente n'autorise rien", () => {
  it("existe, mais n'authentifie pas", async () => {
    const id = await unAdmin();
    await inscrire(id);

    const { token, secondFacteurRequis } = await login(EMAIL, PASSWORD);
    expect(secondFacteurRequis).toBe(true);

    // La session est bien creee — le deuxieme ecran en a besoin...
    const lignes = await db.select().from(session).where(eq(session.accountId, id));
    expect(lignes).toHaveLength(1);
    expect(lignes[0]?.mfaPending).toBe(true);

    // ...mais elle n'ouvre aucune porte.
    expect(await resolveSession(token)).toBeNull();
  });

  it("devient authentifiante une fois le code verifie", async () => {
    const id = await unAdmin();
    const { secret } = await inscrire(id);
    const { token } = await login(EMAIL, PASSWORD);

    await verifierSecondFacteur(token, codeActuel(secret));

    const ctx = await resolveSession(token);
    expect(ctx?.accountId).toBe(id);
  });

  it("reste en attente apres un code faux", async () => {
    const id = await unAdmin();
    await inscrire(id);
    const { token } = await login(EMAIL, PASSWORD);

    await expect(verifierSecondFacteur(token, "000000")).rejects.toThrow(/Code incorrect/);
    expect(await resolveSession(token)).toBeNull();
  });
});

describe("codes de secours", () => {
  it("ouvrent la session quand le telephone est perdu", async () => {
    const id = await unAdmin();
    const { codes } = await inscrire(id);
    const { token } = await login(EMAIL, PASSWORD);

    await verifierSecondFacteur(token, codes[0]!);
    expect((await resolveSession(token))?.accountId).toBe(id);
  });

  it("sont a USAGE UNIQUE", async () => {
    // Sans cela, un papier photographie resterait valable indefiniment.
    const id = await unAdmin();
    const { codes } = await inscrire(id);

    const premiere = await login(EMAIL, PASSWORD);
    await verifierSecondFacteur(premiere.token, codes[0]!);
    expect(await codesDeSecoursRestants(id)).toBe(7);

    const seconde = await login(EMAIL, PASSWORD);
    await expect(verifierSecondFacteur(seconde.token, codes[0]!)).rejects.toThrow(/Code incorrect/);
  });

  it("n'entament pas les autres codes", async () => {
    const id = await unAdmin();
    const { codes } = await inscrire(id);

    const a = await login(EMAIL, PASSWORD);
    await verifierSecondFacteur(a.token, codes[0]!);
    const b = await login(EMAIL, PASSWORD);
    await verifierSecondFacteur(b.token, codes[7]!);

    expect(await codesDeSecoursRestants(id)).toBe(6);
  });
});

describe("retrait du second facteur", () => {
  it("detruit TOUTES les sessions du compte", async () => {
    // Laisser vivre une session ouverte avant la reinitialisation reviendrait
    // a garder une porte que l'on croit avoir fermee.
    const id = await unAdmin();
    const { secret } = await inscrire(id);
    const { token } = await login(EMAIL, PASSWORD);
    await verifierSecondFacteur(token, codeActuel(secret));
    expect(await resolveSession(token)).not.toBeNull();

    await retirerSecondFacteur(id);

    expect(await resolveSession(token)).toBeNull();
    expect(await secondFacteurActif(id)).toBe(false);
    expect(await codesDeSecoursRestants(id)).toBe(0);
  });
});
