import { describe, it, expect, beforeEach } from "vitest";
import { champsMetier } from "../../helpers/champs-metier";
import { eq } from "drizzle-orm";
import { db } from "../../helpers/raw-db";
import { caddie, caddiePersonalData, auditLog } from "@/db/schema";
import {
  construireApercu,
  executerImport,
  rapportErreursCsv,
} from "@/server/services/caddie-import";
import { readBirthYear } from "@/server/pii";
import { resetDb } from "../../helpers/reset-db";
import { testScope } from "../../helpers/scope";
import { makeCourse, makeAccount } from "../../helpers/fixtures";

/**
 * IMPORT CSV DES CADDIES (spéc. 2).
 *
 * Le fichier source a 7 colonnes : nom, prénom, âge, taille d'habits,
 * ancienneté, force, adresse. TROIS sont lues puis REJETÉES.
 */

let courseId: string;
let adminId: string;

beforeEach(async () => {
  await resetDb();
  courseId = await makeCourse("Golf des Cèdres");
  adminId = await makeAccount({ links: [{ courseId, role: "admin" }] });
});

const scope = () => testScope({ accountId: adminId, golfCourseId: courseId, role: "admin" });
const starter = () => testScope({ accountId: adminId, golfCourseId: courseId, role: "starter" });

function fichier(contenu: string, encoding: "utf-8" | "windows-1252" = "utf-8") {
  let bytes: Uint8Array;
  if (encoding === "utf-8") {
    bytes = new TextEncoder().encode(contenu);
  } else {
    // Encodage Windows-1252 rudimentaire : suffisant pour les accents testés.
    bytes = Uint8Array.from([...contenu].map((c) => c.charCodeAt(0) & 0xff));
  }
  return { bytes, size: bytes.length, name: "caddies.csv" };
}

const EN_TETE =
  "numéro de caddie;nom;prénom;âge;taille d'habits;ancienneté;force;adresse du domicile";

describe("détection du format", () => {
  it("détecte l'en-tête, le point-virgule et l'UTF-8", async () => {
    const a = await construireApercu(
      scope(),
      fichier(`${EN_TETE}\n001;Fictif;Hassan;38;L;6;forte;Rue Inventée 1`),
    );
    expect(a.hasHeader).toBe(true);
    expect(a.separator).toBe(";");
    expect(a.encoding).toBe("utf-8");
    expect(a.resume.total).toBe(1);
  });

  it("détecte la virgule comme séparateur", async () => {
    const a = await construireApercu(
      scope(),
      fichier(
        "nom,prénom,âge,taille d'habits,ancienneté,force,adresse du domicile\nFictif,Omar,25,M,2,moyenne,Rue 2",
      ),
    );
    expect(a.separator).toBe(",");
  });

  it("accepte un fichier SANS ligne d'en-tête", async () => {
    const a = await construireApercu(scope(), fichier("101;Fictif;Hassan;38;L;6;forte;Rue 1"));
    expect(a.hasHeader).toBe(false);
    expect(a.resume.total).toBe(1);
    expect(a.lignes[0]?.lastName).toBe("Fictif");
  });

  it("détecte l'encodage Windows-1252 d'un export tableur", async () => {
    const a = await construireApercu(
      scope(),
      fichier("102;Fictif;André;40;L;5;forte;Rue 1", "windows-1252"),
    );
    expect(a.encoding).toBe("windows-1252");
    expect(a.lignes[0]?.firstName).toBe("André");
  });
});

describe("les trois colonnes interdites sont rejetées", () => {
  it("annonce explicitement ce qui ne sera pas conservé", async () => {
    const a = await construireApercu(
      scope(),
      fichier(`${EN_TETE}\n002;Fictif;Hassan;38;XL;6;très forte;Rue Inventée 1`),
    );
    expect(a.colonnesRejetees).toEqual(["taille d'habits", "force", "adresse du domicile"]);
  });

  it("n'écrit NI taille d'habits, NI force, NI adresse en base", async () => {
    const a = await construireApercu(
      scope(),
      fichier(`${EN_TETE}\n003;Fictif;Hassan;38;XL;6;très forte;Rue Inventée 1`),
    );
    await executerImport(scope(), a, new Map());

    const rows = await db.select().from(caddie).where(eq(caddie.golfCourseId, courseId));
    const serialise = JSON.stringify(rows);

    expect(serialise).not.toContain("XL");
    expect(serialise).not.toContain("très forte");
    expect(serialise).not.toContain("Rue Inventée");
  });

  it("convertit l'âge en année de naissance, rangée à part", async () => {
    const a = await construireApercu(
      scope(),
      fichier(`${EN_TETE}\n004;Fictif;Hassan;38;XL;6;forte;Rue 1`),
    );
    await executerImport(scope(), a, new Map());

    const rows = await db.select().from(caddie).where(eq(caddie.golfCourseId, courseId));

    expect(champsMetier(rows)).not.toContain("38");

    const annee = await readBirthYear(scope(), rows[0]!.id);
    expect(annee).toBe(new Date().getFullYear() - 38);
  });
});

describe("validation des lignes", () => {
  it("signale un nom ou un prénom manquant", async () => {
    const a = await construireApercu(
      scope(),
      fichier(`${EN_TETE}\n005;;Hassan;38;L;6;forte;Rue 1\n006;Fictif;;25;M;2;moyenne;Rue 2`),
    );
    expect(a.resume.invalides).toBe(2);
    expect(a.lignes[0]?.erreurs.join()).toMatch(/Nom manquant/);
    expect(a.lignes[1]?.erreurs.join()).toMatch(/Prénom manquant/);
  });

  it("signale un âge aberrant", async () => {
    const a = await construireApercu(
      scope(),
      fichier(`${EN_TETE}\n007;Fictif;Hassan;150;L;6;forte;Rue 1`),
    );
    expect(a.lignes[0]?.statut).toBe("invalide");
    expect(a.lignes[0]?.erreurs.join()).toMatch(/Âge invalide/);
  });

  it("signale une ancienneté invalide", async () => {
    const a = await construireApercu(
      scope(),
      fichier(`${EN_TETE}\n008;Fictif;Hassan;38;L;abc;forte;Rue 1`),
    );
    expect(a.lignes[0]?.erreurs.join()).toMatch(/Ancienneté invalide/);
  });

  it("refuse deux fois le même numéro dans le fichier", async () => {
    const a = await construireApercu(
      scope(),
      fichier(`${EN_TETE}\n009;Fictif;Hassan;38;L;6;forte;Rue 1\n009;Autre;Omar;30;M;2;moyenne;Rue 2`),
    );
    expect(a.lignes[1]?.erreurs.join()).toMatch(/Numéro déjà utilisé/);
  });

  it("refuse un fichier vide", async () => {
    await expect(construireApercu(scope(), fichier(EN_TETE))).rejects.toThrow(/aucune ligne/);
  });

  it("refuse un fichier qui n'est pas un CSV", async () => {
    const f = fichier("peu importe");
    await expect(construireApercu(scope(), { ...f, name: "caddies.xlsx" })).rejects.toThrow(
      /\.csv/,
    );
  });

  it("refuse un fichier trop volumineux", async () => {
    const f = fichier("a;b");
    await expect(construireApercu(scope(), { ...f, size: 9_000_000 })).rejects.toThrow(
      /volumineux/,
    );
  });
});

describe("doublons vis-à-vis des caddies déjà enregistrés", () => {
  beforeEach(async () => {
    const a = await construireApercu(
      scope(),
      fichier(`${EN_TETE}\n011;Fictif;Hassan;38;L;6;forte;Rue 1`),
    );
    await executerImport(scope(), a, new Map());
  });

  it("signale le doublon et nomme le caddie existant", async () => {
    const a = await construireApercu(
      scope(),
      fichier(`${EN_TETE}\n011;Fictif;Hassan;38;L;7;forte;Rue 1`),
    );
    expect(a.resume.doublons).toBe(1);
    expect(a.lignes[0]?.doublonRef).toBe("011");
  });

  it("IGNORE le doublon par défaut : aucune décision, aucune écriture", async () => {
    const a = await construireApercu(
      scope(),
      fichier(`${EN_TETE}\n011;Fictif;Hassan;38;L;7;forte;Rue 1`),
    );
    await expect(executerImport(scope(), a, new Map())).rejects.toThrow(/Aucune ligne/);

    const rows = await db.select().from(caddie).where(eq(caddie.golfCourseId, courseId));
    expect(rows[0]?.seniorityYears).toBe(6);
  });

  it("remplace quand l'administrateur le décide ligne par ligne", async () => {
    const a = await construireApercu(
      scope(),
      fichier(`${EN_TETE}\n011;Fictif;Hassan;38;L;7;forte;Rue 1`),
    );
    const rapport = await executerImport(scope(), a, new Map([[1, "remplacer"]]));

    expect(rapport.remplaces).toBe(1);
    expect(rapport.crees).toBe(0);

    const rows = await db.select().from(caddie).where(eq(caddie.golfCourseId, courseId));
    expect(rows).toHaveLength(1);
    expect(rows[0]?.seniorityYears).toBe(7);
  });
});

describe("exécution de l'import", () => {
  it("reprend les numéros du fichier, sans jamais en inventer", async () => {
    const a = await construireApercu(
      scope(),
      fichier(`${EN_TETE}\n015;Fictif;Hassan;38;L;6;forte;R1\n016;Fictif;Omar;25;M;2;moyenne;R2`),
    );
    const rapport = await executerImport(scope(), a, new Map());

    expect(rapport.crees).toBe(2);
    expect(rapport.refs).toEqual(["015", "016"]);
  });

  it("n'écrit RIEN si la transaction échoue — aucune importation partielle", async () => {
    const a = await construireApercu(scope(), fichier(`${EN_TETE}\n017;Fictif;Hassan;38;L;6;forte;R1`));
    // On force un conflit en détournant l'identifiant vers une valeur invalide.
    a.lignes[0]!.birthYear = 1800;

    await expect(executerImport(scope(), a, new Map())).rejects.toThrow();

    const rows = await db.select().from(caddie).where(eq(caddie.golfCourseId, courseId));
    expect(rows).toEqual([]);
    const pii = await db.select().from(caddiePersonalData);
    expect(pii).toEqual([]);
  });

  it("journalise chaque création", async () => {
    const a = await construireApercu(
      scope(),
      fichier(`${EN_TETE}\n018;Fictif;Hassan;38;L;6;forte;R1\n019;Fictif;Omar;25;M;2;moyenne;R2`),
    );
    await executerImport(scope(), a, new Map());

    const entries = await db.select().from(auditLog).where(eq(auditLog.action, "caddie.create"));
    expect(entries).toHaveLength(2);
  });

  it("produit une liste d'erreurs téléchargeable", async () => {
    const a = await construireApercu(scope(), fichier(`${EN_TETE}\n020;;Hassan;38;L;6;forte;R1`));
    const csv = rapportErreursCsv(a);
    expect(csv.split("\n")[0]).toBe("ligne;statut;nom;prenom;erreurs");
    expect(csv).toMatch(/Nom manquant/);
  });
});

describe("permissions", () => {
  it("interdit l'import à un Starter (FR-020)", async () => {
    await expect(
      construireApercu(starter(), fichier(`${EN_TETE}\n021;Fictif;Hassan;38;L;6;forte;R1`)),
    ).rejects.toThrow(/droits/);
  });
});
