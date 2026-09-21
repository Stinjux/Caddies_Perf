import { describe, it, expect } from "vitest";
import { localDateFor, formatInCourseTimezone, isValidTimezone } from "@/lib/timezone";

/**
 * T037 — les dates suivent le fuseau du PARCOURS, jamais celui du lecteur
 * (FR-005), et la date locale sert de cle au decompte des jours travailles
 * (FR-044).
 */

describe("date locale du parcours (FR-005)", () => {
  it("ne depend pas du fuseau du serveur ni du navigateur", () => {
    const instant = new Date("2026-06-15T02:00:00Z");
    expect(localDateFor(instant, "Africa/Casablanca")).toBe("2026-06-15");
    expect(localDateFor(instant, "America/Montreal")).toBe("2026-06-14");
  });

  it("reste correcte de part et d'autre de minuit local", () => {
    // En juin le Maroc est a UTC+1 : 23h30 UTC est deja le lendemain sur place.
    const avant = new Date("2026-06-10T22:45:00Z");
    const apres = new Date("2026-06-10T23:30:00Z");
    expect(localDateFor(avant, "Africa/Casablanca")).toBe("2026-06-10");
    expect(localDateFor(apres, "Africa/Casablanca")).toBe("2026-06-11");
  });

  it("suit le decalage reel du Maroc, qui passe a UTC+0 pendant le Ramadan", () => {
    // Piege verifie : a la meme heure UTC, la date locale differe selon la
    // periode. Un calcul a decalage fige se tromperait ici.
    const pendantRamadan = new Date("2026-03-10T23:30:00Z");
    const horsRamadan = new Date("2026-06-10T23:30:00Z");
    expect(localDateFor(pendantRamadan, "Africa/Casablanca")).toBe("2026-03-10");
    expect(localDateFor(horsRamadan, "Africa/Casablanca")).toBe("2026-06-11");
  });

  it("produit toujours le format AAAA-MM-JJ", () => {
    expect(localDateFor(new Date("2026-01-05T10:00:00Z"), "Africa/Casablanca")).toMatch(
      /^\d{4}-\d{2}-\d{2}$/,
    );
  });
});

describe("affichage dans le fuseau du parcours", () => {
  it("affiche deux heures differentes pour deux parcours distants", () => {
    const instant = new Date("2026-09-17T15:00:00Z");
    expect(formatInCourseTimezone(instant, "Africa/Casablanca")).not.toBe(
      formatInCourseTimezone(instant, "Asia/Tokyo"),
    );
  });

  it("refuse un fuseau invalide avant tout enregistrement", () => {
    expect(isValidTimezone("Africa/Casablanca")).toBe(true);
    expect(isValidTimezone("")).toBe(false);
  });
});
