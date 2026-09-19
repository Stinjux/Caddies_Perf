import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

/**
 * T080 / SCENARIO V-12 — AUCUNE DONNEE REELLE DANS LE DEPOT (principe II).
 *
 * Garde-fou PERMANENT, rejoue a chaque phase. Il echoue le jour ou un export
 * de production, un fichier de configuration ou un nom reel entre dans
 * l'historique Git.
 */

function tracked(): string[] {
  return execFileSync("git", ["ls-files"], { encoding: "utf8" }).trim().split("\n");
}

function contenuVersionne(): string {
  const fichiers = tracked().filter((f) => /\.(ts|tsx|md|json|sql|css|mjs|yml|yaml)$/.test(f));
  return fichiers.map((f) => readFileSync(f, "utf8")).join("\n");
}

describe("principe II — aucune donnee reelle dans le dépôt", () => {
  it("ne versionne aucun CSV hors de fixtures/", () => {
    const csv = tracked().filter((f) => f.endsWith(".csv") && !f.startsWith("fixtures/"));
    expect(csv).toEqual([]);
  });

  it("ne versionne aucun fichier .env reel (.env.example est attendu)", () => {
    const env = tracked().filter(
      (f) => (f === ".env" || f.startsWith(".env.")) && f !== ".env.example",
    );
    expect(env).toEqual([]);
  });

  it("ne versionne pas le dossier agent .claude/", () => {
    expect(tracked().filter((f) => f.startsWith(".claude/"))).toEqual([]);
  });

  it("ne place aucune valeur reelle dans .env.example", () => {
    const lines = readFileSync(".env.example", "utf8")
      .split("\n")
      .filter((l) => l.includes("=") && !l.trimStart().startsWith("#"));
    const secrets = lines.filter((l) => {
      const value = l.slice(l.indexOf("=") + 1).trim();
      // Les deux gabarits d'URL admis portent le mot « motdepasse » en clair :
      // personne ne peut les prendre pour de vraies valeurs.
      const gabarit =
        value.startsWith("postgresql://utilisateur:motdepasse@") ||
        value.startsWith("postgresql://caddieperf_app:motdepasse@");
      return value.length > 0 && !gabarit && !/^\d+$/.test(value);
    });
    expect(secrets).toEqual([]);
  });
});

/** Le code de l'application et le gabarit d'environnement, rien d'autre. */
function sourcesEtEnvironnement(): string {
  return tracked()
    .filter((f) => f === ".env.example" || (f.startsWith("src/") && /\.(ts|tsx|css)$/.test(f)))
    .map((f) => readFileSync(f, "utf8"))
    .join("\n");
}

describe("aucun secret ne part dans le navigateur", () => {
  it("ne declare aucune variable NEXT_PUBLIC_", () => {
    // Tout ce qui porte ce prefixe est INCORPORE au code envoye au navigateur.
    // Le projet n'en a aucune, et n'en a pas besoin : rien de ce qu'il connait
    // n'a a etre lu par le client. Ce test existe pour que cela reste vrai le
    // jour ou quelqu'un voudra « juste exposer une petite cle ».
    // On n'inspecte que le CODE et le gabarit d'environnement, pas le depot
    // entier : ce fichier-ci contient les chaines qu'il cherche, et se serait
    // signale lui-meme. C'est le quatrieme motif trop large de ce projet.
    expect(sourcesEtEnvironnement()).not.toContain("NEXT_PUBLIC_");
  });

  it("n'expose aucune cle publique de service tiers", () => {
    // Les noms usuels d'une cle cliente chez les fournisseurs habituels.
    // Le projet parle a PostgreSQL en direct, depuis le serveur : aucune de
    // ces cles n'a de raison d'exister ici.
    const contenu = sourcesEtEnvironnement();
    for (const motif of ["anonKey", "ANON_KEY", "publishableKey", "PUBLISHABLE_KEY", "apiKey:"]) {
      expect(contenu).not.toContain(motif);
    }
  });
});

describe("la regle sur les assistants d'IA ne peut pas disparaitre en silence", () => {
  it("la constitution interdit toute donnee reelle dans un prompt", () => {
    // Une regle qu'aucun test ne garde finit par etre retiree sans que
    // personne ne s'en apercoive. Celle-ci ne peut pas l'etre.
    const constitution = readFileSync(".specify/memory/constitution.md", "utf8");
    expect(constitution).toMatch(/assistants d'intelligence artificielle/i);
    expect(constitution).toMatch(/prompt/i);
    expect(constitution).toMatch(/base de \*\*développement\*\*|développement.*fixtures/i);
  });
});

describe("aucune donnee personnelle reelle dans le code versionne", () => {
  const contenu = contenuVersionne();

  it("ne contient aucun numero de telephone marocain", () => {
    // Un vrai numero marocain porte NEUF chiffres apres l'indicatif. Le motif
    // court attrapait « U+2122 », qui est une plage Unicode de feuille de
    // style — un faux positif qui aurait fini par etre ignore, et un garde-fou
    // qu'on ignore ne garde plus rien.
    expect(contenu).not.toMatch(/\+212[\s.-]?\d{9}/);
  });

  it("n'utilise que des adresses de courriel du domaine reserve example.invalid", () => {
    const adresses = contenu.match(/[\w.+-]+@[\w.-]+\.\w{2,}/g) ?? [];
    const reelles = adresses.filter((brut) => {
      const a = brut.toLowerCase();
      return (
        !a.endsWith("@example.invalid") &&
        !a.endsWith("@example.com") &&
        !a.includes("noreply@anthropic.com")
      );
    });
    expect(reelles).toEqual([]);
  });

  it("ne contient aucun haché de mot de passe porteur de matériel réel", () => {
    // Un vrai hache porte un sel et une cle en base64 de grande longueur.
    // Le leurre a temps constant, lui, n'a que des octets nuls.
    const vrais = contenu.match(/scrypt\$\d+\$\d+\$\d+\$[A-Za-z0-9+/=]{16,}\$[A-Za-z0-9+/=]{40,}/g);
    expect(vrais).toBeNull();
  });

  it("n'utilise que des adresses Web fictives dans les fixtures", () => {
    const fixtures = readFileSync("fixtures/seed-data.ts", "utf8");
    const urls = fixtures.match(/https?:\/\/[^\s"']+/g) ?? [];
    expect(urls.every((u) => u.includes("example.invalid"))).toBe(true);
  });

  it("marque explicitement les noms des fixtures comme fictifs", () => {
    const fixtures = readFileSync("fixtures/seed-data.ts", "utf8");
    expect(fixtures).toContain("FICTIF");
    expect(fixtures).toMatch(/Fictif|Exemple/);
  });
});

describe("le .gitignore protege activement", () => {
  it("bloque les emplacements de donnees reelles", () => {
    const gitignore = readFileSync(".gitignore", "utf8");
    for (const motif of ["*.csv", ".env", ".claude/", "/imports/", "/data/reel/"]) {
      expect(gitignore).toContain(motif);
    }
  });
});
