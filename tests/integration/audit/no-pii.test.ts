import { describe, it, expect, beforeEach } from "vitest";
import { db } from "../../helpers/raw-db";
import { auditLog, caddie, caddiePersonalData } from "@/db/schema";
import { uuidv7 } from "@/lib/uuid";
import { createCourse, updateCourse } from "@/server/services/golf-course";
import { createAccount } from "@/server/services/account";
import { readBirthYear, writeBirthYear } from "@/server/pii";
import { listAuditInScope } from "@/server/repositories/audit";
import { resetDb } from "../../helpers/reset-db";
import { testScope } from "../../helpers/scope";
import { makeCourse, makeAccount, PASSWORD } from "../../helpers/fixtures";

/**
 * T070 — AUCUNE DONNEE PERSONNELLE DANS LE JOURNAL (FR-037).
 *
 * Un journal qui consigne les valeurs modifiees devient lui-meme une base
 * de donnees personnelles, echappant a toute politique de conservation.
 * Ici, une entree ne porte QUE des identifiants internes.
 */

let courseId: string;
let adminId: string;

beforeEach(async () => {
  await resetDb();
  courseId = await makeCourse("Golf des Cèdres");
  adminId = await makeAccount({ generalAdmin: true, links: [{ courseId, role: "admin" }] });
});

const scope = () => testScope({ accountId: adminId, golfCourseId: courseId, role: "admin" });

async function journalSerialise(): Promise<string> {
  return JSON.stringify(await db.select().from(auditLog));
}

describe("le journal ne consigne aucune valeur métier", () => {
  it("ne contient pas le nom d'un parcours créé ou modifié", async () => {
    const id = await createCourse(adminId, {
      name: "Nom Très Reconnaissable",
      timezone: "Africa/Casablanca",
    });
    const s = testScope({ accountId: adminId, golfCourseId: id, role: "admin" });
    await updateCourse(s, { name: "Autre Nom Distinctif", timezone: "Africa/Casablanca" }, 1);

    const journal = await journalSerialise();
    expect(journal).not.toContain("Nom Très Reconnaissable");
    expect(journal).not.toContain("Autre Nom Distinctif");
  });

  it("ne contient ni l'adresse de courriel ni le nom d'un compte créé", async () => {
    await createAccount(scope(), {
      email: "reconnaissable@example.invalid",
      firstName: "PrenomUnique",
      lastName: "NomUnique",
      password: PASSWORD,
      role: "starter",
    });

    const journal = await journalSerialise();
    expect(journal).not.toContain("reconnaissable@example.invalid");
    expect(journal).not.toContain("PrenomUnique");
    expect(journal).not.toContain("NomUnique");
  });

  it("ne contient jamais un mot de passe ni son haché", async () => {
    await createAccount(scope(), {
      email: "secret@example.invalid",
      firstName: "P",
      lastName: "F",
      password: PASSWORD,
      role: "starter",
    });

    const journal = await journalSerialise();
    expect(journal).not.toContain(PASSWORD);
    expect(journal).not.toContain("scrypt$");
  });

  it("ne contient pas l'année de naissance lue ou écrite", async () => {
    const caddieId = uuidv7();
    await db.insert(caddie).values({
      id: caddieId,
      golfCourseId: courseId,
      internalRef: "CED-001",
      firstName: "Hassan",
      lastName: "Fictif",
    });
    await db.insert(caddiePersonalData).values({ caddieId, birthYear: 1988 });

    await readBirthYear(scope(), caddieId);
    await writeBirthYear(scope(), caddieId, 1991);

    const journal = await journalSerialise();
    expect(journal).not.toContain("1988");
    expect(journal).not.toContain("1991");
  });
});

describe("structure d'une entrée", () => {
  it("n'expose que les colonnes prévues, aucune colonne de contenu", async () => {
    await createAccount(scope(), {
      email: "structure@example.invalid",
      firstName: "P",
      lastName: "F",
      password: PASSWORD,
      role: "starter",
    });

    const rows = await db.select().from(auditLog);
    expect(Object.keys(rows[0]!).sort()).toEqual([
      "action",
      "actorAccountId",
      "golfCourseId",
      "id",
      "occurredAt",
      "targetId",
      "targetType",
    ]);
  });

  it("la vue de consultation n'ajoute que le nom de l'auteur, jamais la cible", async () => {
    await createAccount(scope(), {
      email: "vue@example.invalid",
      firstName: "P",
      lastName: "F",
      password: PASSWORD,
      role: "starter",
    });

    const vue = await listAuditInScope(scope());
    const serialise = JSON.stringify(vue);

    // Le nom de l'AUTEUR est necessaire pour la lisibilite ; celui de la
    // CIBLE ne l'est pas et ne doit pas apparaitre.
    expect(serialise).not.toContain("vue@example.invalid");
    expect(Object.keys(vue[0]!).sort()).toEqual([
      "action",
      "actorFirstName",
      "actorLastName",
      "id",
      "occurredAt",
      "targetId",
      "targetType",
    ]);
  });
});
