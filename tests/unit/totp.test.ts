import { describe, it, expect } from "vitest";
import {
  encoderBase32,
  decoderBase32,
  genererSecret,
  codeActuel,
  codeValide,
  uriOtpauth,
  genererCodesDeSecours,
} from "@/lib/totp";

/**
 * SECOND FACTEUR (RFC 6238). Les vecteurs officiels de la RFC servent de
 * reference : une implementation maison qui ne les reproduit pas ne serait
 * compatible avec aucune application d'authentification.
 */

// Secret de la RFC 6238 : la chaine ASCII "12345678901234567890", en base32.
const SECRET_RFC = encoderBase32(Buffer.from("12345678901234567890"));

describe("vecteurs officiels de la RFC 6238 (SHA-1, 6 chiffres)", () => {
  const cas: [number, string][] = [
    [59, "287082"],
    [1111111109, "081804"],
    [1111111111, "050471"],
    [1234567890, "005924"],
    [2000000000, "279037"],
  ];

  for (const [secondes, attendu] of cas) {
    it(`a ${secondes} s produit ${attendu}`, () => {
      expect(codeActuel(SECRET_RFC, new Date(secondes * 1000))).toBe(attendu);
    });
  }
});

describe("base32", () => {
  it("fait l'aller-retour sans perte", () => {
    const octets = Buffer.from([0, 1, 127, 128, 255, 42]);
    expect(decoderBase32(encoderBase32(octets))).toEqual(octets);
  });

  it("tolere les espaces et les minuscules, comme les saisies manuelles", () => {
    const secret = genererSecret();
    const saisiALaMain = secret.toLowerCase().replace(/(.{4})/g, "$1 ");
    expect(decoderBase32(saisiALaMain)).toEqual(decoderBase32(secret));
  });
});

describe("validation d'un code", () => {
  const secret = genererSecret();
  const t0 = new Date(1_700_000_000_000);

  it("accepte le code de l'instant", () => {
    expect(codeValide(secret, codeActuel(secret, t0), t0)).toBe(true);
  });

  it("accepte le code de l'etape precedente et de la suivante", () => {
    // Un telephone dont l'horloge derive de quelques secondes reste utilisable.
    const avant = new Date(t0.getTime() - 30_000);
    const apres = new Date(t0.getTime() + 30_000);
    expect(codeValide(secret, codeActuel(secret, avant), t0)).toBe(true);
    expect(codeValide(secret, codeActuel(secret, apres), t0)).toBe(true);
  });

  it("REFUSE au-dela de la tolerance", () => {
    const vieux = new Date(t0.getTime() - 120_000);
    expect(codeValide(secret, codeActuel(secret, vieux), t0)).toBe(false);
  });

  it("refuse un code d'un autre secret", () => {
    expect(codeValide(secret, codeActuel(genererSecret(), t0), t0)).toBe(false);
  });

  it("refuse ce qui n'a pas six chiffres", () => {
    expect(codeValide(secret, "", t0)).toBe(false);
    expect(codeValide(secret, "12345", t0)).toBe(false);
    expect(codeValide(secret, "1234567", t0)).toBe(false);
    expect(codeValide(secret, "abcdef", t0)).toBe(false);
  });

  it("tolere un code saisi avec un espace au milieu", () => {
    const code = codeActuel(secret, t0);
    expect(codeValide(secret, `${code.slice(0, 3)} ${code.slice(3)}`, t0)).toBe(true);
  });
});

describe("secret et adresse d'inscription", () => {
  it("produit un secret de 160 bits", () => {
    expect(decoderBase32(genererSecret())).toHaveLength(20);
  });

  it("ne produit jamais deux fois le meme secret", () => {
    const secrets = new Set(Array.from({ length: 50 }, () => genererSecret()));
    expect(secrets.size).toBe(50);
  });

  it("compose une adresse otpauth lisible par les applications", () => {
    const uri = uriOtpauth("ABCDEFGHIJKLMNOP", "admin@example.invalid");
    expect(uri).toMatch(/^otpauth:\/\/totp\/CaddiePerf%3Aadmin%40example\.invalid\?/);
    expect(uri).toContain("secret=ABCDEFGHIJKLMNOP");
    expect(uri).toContain("issuer=CaddiePerf");
    expect(uri).toContain("digits=6");
    expect(uri).toContain("period=30");
  });
});

describe("codes de secours", () => {
  it("en produit huit, distincts et lisibles", () => {
    const codes = genererCodesDeSecours();
    expect(codes).toHaveLength(8);
    expect(new Set(codes).size).toBe(8);
    for (const c of codes) expect(c).toMatch(/^[0-9A-F]{5}-[0-9A-F]{5}$/);
  });
});

describe("fonctionne au Maroc, y compris pendant le Ramadan", () => {
  /**
   * Le Maroc vit a UTC+1 toute l'annee SAUF pendant le Ramadan, ou il
   * repasse a UTC+0. Ce saut a deja fait echouer un test de ce projet.
   *
   * Le TOTP y est insensible par construction : il compte les secondes
   * ecoulees depuis l'epoque Unix, un instant absolu que nul fuseau ne
   * decale. Ces tests le PROUVENT plutot que de le supposer — c'est la
   * difference entre « cela devrait marcher » et « cela marche ».
   */
  const secret = genererSecret();

  it("donne le meme code quel que soit le fuseau declare", () => {
    const instant = Date.UTC(2026, 2, 15, 12, 0, 0);
    // Deux objets Date construits differemment, un seul et meme instant.
    expect(codeActuel(secret, new Date(instant))).toBe(
      codeActuel(secret, new Date(new Date(instant).toISOString())),
    );
  });

  it("reste valable au basculement UTC+1 → UTC+0 du Ramadan", () => {
    // 2026 : le Maroc passe a UTC+0 pour le mois de Ramadan. Un code emis
    // une seconde avant le basculement doit rester accepte juste apres.
    const avant = new Date(Date.UTC(2026, 1, 17, 1, 59, 59));
    const apres = new Date(avant.getTime() + 1000);
    expect(codeValide(secret, codeActuel(secret, avant), apres)).toBe(true);
  });

  it("refuse un code d'il y a une heure, meme a l'heure du changement", () => {
    // Le garde-fou doit rester serre : un decalage d'une heure n'est pas
    // une derive d'horloge, c'est un code perime.
    const t = new Date(Date.UTC(2026, 1, 17, 2, 0, 0));
    const ilYaUneHeure = new Date(t.getTime() - 3_600_000);
    expect(codeValide(secret, codeActuel(secret, ilYaUneHeure), t)).toBe(false);
  });
});
