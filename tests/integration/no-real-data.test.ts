import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

/**
 * Garde-fou permanent du principe II de la constitution :
 * aucune donnee reelle dans le depot. Rejoue a chaque phase.
 */

function tracked(): string[] {
  return execFileSync("git", ["ls-files"], { encoding: "utf8" }).trim().split("\n");
}

describe("principe II — aucune donnee reelle dans le depot", () => {
  it("ne versionne aucun CSV hors de fixtures/", () => {
    const csv = tracked().filter((f) => f.endsWith(".csv") && !f.startsWith("fixtures/"));
    expect(csv).toEqual([]);
  });

  it("ne versionne aucun fichier .env", () => {
    const env = tracked().filter((f) => f === ".env" || f.startsWith(".env."));
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
      return (
        value.length > 0 && !value.startsWith("postgresql://utilisateur:") && !/^\d+$/.test(value)
      );
    });
    expect(secrets).toEqual([]);
  });
});
