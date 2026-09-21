import { describe, it, expect } from "vitest";
import { uuidv7 } from "@/lib/uuid";
import { isValidTimezone, localDateFor, formatInCourseTimezone } from "@/lib/timezone";
import { hashPassword, verifyPassword } from "@/server/auth/password";

describe("uuidv7", () => {
  it("produit un identifiant au format UUID de version 7", () => {
    expect(uuidv7()).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });

  it("produit des identifiants ordonnables dans le temps", () => {
    const early = uuidv7(1_000_000_000_000);
    const late = uuidv7(2_000_000_000_000);
    expect(early < late).toBe(true);
  });

  it("ne produit jamais deux fois le meme identifiant", () => {
    const set = new Set(Array.from({ length: 1000 }, () => uuidv7()));
    expect(set.size).toBe(1000);
  });
});

describe("fuseaux horaires (FR-005, FR-044)", () => {
  it("accepte un identifiant IANA valide et refuse le reste", () => {
    expect(isValidTimezone("Africa/Casablanca")).toBe(true);
    expect(isValidTimezone("Pas/UnFuseau")).toBe(false);
  });

  it("derive la date locale du parcours, pas celle du serveur", () => {
    // 23h30 UTC le 17 : deja le 18 a Tokyo, encore le 17 a Montreal.
    const instant = new Date("2026-09-17T23:30:00Z");
    expect(localDateFor(instant, "Asia/Tokyo")).toBe("2026-09-18");
    expect(localDateFor(instant, "Africa/Casablanca")).toBe("2026-09-18");
    expect(localDateFor(instant, "America/Montreal")).toBe("2026-09-17");
  });

  it("affiche un instant dans le fuseau du parcours", () => {
    const instant = new Date("2026-09-17T12:00:00Z");
    const montreal = formatInCourseTimezone(instant, "America/Montreal");
    const tokyo = formatInCourseTimezone(instant, "Asia/Tokyo");
    expect(montreal).not.toBe(tokyo);
  });
});

describe("hachage de mot de passe (FR-017)", () => {
  it("ne stocke jamais le mot de passe en clair", async () => {
    const hash = await hashPassword("MotDePasseFictif1!");
    expect(hash).not.toContain("MotDePasseFictif1!");
    expect(hash.startsWith("scrypt$")).toBe(true);
  });

  it("valide le bon mot de passe et rejette le mauvais", async () => {
    const hash = await hashPassword("MotDePasseFictif1!");
    expect(await verifyPassword("MotDePasseFictif1!", hash)).toBe(true);
    expect(await verifyPassword("MauvaisMotDePasse", hash)).toBe(false);
  });

  it("produit un hache different a chaque fois, grace au sel", async () => {
    const a = await hashPassword("MotDePasseFictif1!");
    const b = await hashPassword("MotDePasseFictif1!");
    expect(a).not.toBe(b);
  });

  it("rejette un hache malforme sans lever d'exception", async () => {
    expect(await verifyPassword("peu importe", "n_importe_quoi")).toBe(false);
  });
});
