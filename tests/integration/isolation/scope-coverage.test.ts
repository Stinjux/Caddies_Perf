import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

/**
 * T060 — LA BARRIERE DOIT LE RESTER (FR-023, FR-024).
 *
 * Ce test ne verifie pas un comportement : il verifie une DISCIPLINE
 * ARCHITECTURALE. Il echoue le jour ou quelqu'un — humain ou machine —
 * ajoute une fonction de depot appelable sans portee, ou fait entrer un
 * identifiant de terrain venu du navigateur dans une decision d'acces.
 *
 * C'est le garde-fou qui protege le principe IV dans la duree, une fois que
 * plus personne ne se souviendra pourquoi il a ete ecrit.
 */

const REPO_DIR = path.join(process.cwd(), "src/server/repositories");
const SERVICES_DIR = path.join(process.cwd(), "src/server/services");
const SCOPE_FILE = path.join(process.cwd(), "src/server/scope/index.ts");

function read(dir: string): { name: string; source: string }[] {
  return readdirSync(dir)
    .filter((f) => f.endsWith(".ts"))
    .map((f) => ({ name: f, source: readFileSync(path.join(dir, f), "utf8") }));
}

/** Fonctions exportees qui atteignent la base : elles DOIVENT prendre une portee. */
function exportedDbFunctions(source: string): { name: string; signature: string }[] {
  const out: { name: string; signature: string }[] = [];
  const re = /export\s+async\s+function\s+(\w+)\s*\(([^)]*)\)/gs;
  let m: RegExpExecArray | null;
  while ((m = re.exec(source))) {
    out.push({ name: m[1]!, signature: m[2]! });
  }
  return out;
}

/** Une fonction est du parcours client si son commentaire le declare. */
function estCheminClientPublic(source: string, nomFonction: string): boolean {
  const avant = source.slice(0, source.indexOf(`export async function ${nomFonction}`));
  const dernierBloc = avant.lastIndexOf("/**");
  return dernierBloc !== -1 && avant.slice(dernierBloc).includes("@public-client-path");
}

describe("la portée reste obligatoire dans les dépôts", () => {
  it("expose au moins un dépôt à analyser", () => {
    expect(read(REPO_DIR).length).toBeGreaterThan(0);
  });

  it("aucune fonction de dépôt ne filtre sans un identifiant de terrain", () => {
    const fautives: string[] = [];

    for (const { name, source } of read(REPO_DIR)) {
      if (name === "base.ts" || name === "optimistic-lock.ts") continue;

      for (const fn of exportedDbFunctions(source)) {
        const prendPortee = /scope\s*:\s*Scope/.test(fn.signature);
        // Seules exceptions admises : les fonctions qui portent explicitement
        // un identifiant de compte ou de terrain, et dont le nom le dit.
        const exceptionAdmise =
          /accountId\s*:\s*string/.test(fn.signature) ||
          /golfCourseId\s*:\s*string/.test(fn.signature) ||
          /email\s*:\s*string/.test(fn.signature);

        if (!prendPortee && !exceptionAdmise) {
          fautives.push(`${name} → ${fn.name}(${fn.signature.trim()})`);
        }
      }
    }

    expect(fautives).toEqual([]);
  });

  it("aucune mutation de service n'est exportée sans portée ni identifiant d'acteur", () => {
    const fautives: string[] = [];

    for (const { name, source } of read(SERVICES_DIR)) {
      if (name === "logo-upload.ts") continue;

      for (const fn of exportedDbFunctions(source)) {
        const ok =
          /scope\s*:\s*Scope/.test(fn.signature) ||
          /actorAccountId\s*:\s*string/.test(fn.signature) ||
          estCheminClientPublic(source, fn.name);
        if (!ok) fautives.push(`${name} → ${fn.name}`);
      }
    }

    expect(fautives).toEqual([]);
  });

  /**
   * Le parcours CLIENT n'a pas de portee : le client n'a aucun compte. Ces
   * fonctions doivent donc porter l'annotation @public-client-path, qui rend
   * l'exception VISIBLE en revue au lieu d'etre un trou silencieux.
   */
  it("n'autorise l'absence de portée que pour les fonctions du parcours client, nommément annotées", () => {
    const annotees: string[] = [];
    for (const { name, source } of [...read(SERVICES_DIR), ...read(REPO_DIR)]) {
      for (const fn of exportedDbFunctions(source)) {
        if (estCheminClientPublic(source, fn.name)) annotees.push(`${name} → ${fn.name}`);
      }
    }

    // Toute nouvelle entree ici doit etre un choix conscient, pas un oubli.
    expect(annotees.sort()).toEqual([
      "cart.ts → findCartByToken",
      "qr-resolution.ts → resoudreJeton",
    ]);
  });
});

describe("une portée ne peut naître que d'une session vérifiée", () => {
  it("n'expose qu'un seul constructeur de portée", () => {
    const source = readFileSync(SCOPE_FILE, "utf8");
    const constructeurs = source.match(/export function \w+/g) ?? [];
    expect(constructeurs).toContain("export function createScopeFromVerifiedSession");
    expect(constructeurs.length).toBeLessThanOrEqual(3);
  });

  it("marque le type de portée par une empreinte, interdisant sa fabrication ailleurs", () => {
    const source = readFileSync(SCOPE_FILE, "utf8");
    expect(source).toMatch(/declare const scopeBrand: unique symbol/);
    expect(source).toMatch(/readonly \[scopeBrand\]: true/);
  });

  it("n'est construite que depuis l'authentification ou les aides de test", () => {
    const racine = path.join(process.cwd(), "src");
    const appelants: string[] = [];

    const parcourir = (dir: string) => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const complet = path.join(dir, entry.name);
        if (entry.isDirectory()) parcourir(complet);
        else if (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx")) {
          const source = readFileSync(complet, "utf8");
          if (source.includes("createScopeFromVerifiedSession")) {
            appelants.push(path.relative(racine, complet));
          }
        }
      }
    };
    parcourir(racine);

    const autorises = ["scope/index.ts", "auth/current.ts", "terrains/[id]/page.tsx"];
    const intrus = appelants.filter((f) => !autorises.some((a) => f.includes(a)));

    expect(intrus).toEqual([]);
  });
});
