import { describe, it, expect, beforeEach } from "vitest";
import { db } from "../helpers/raw-db";
import { account } from "@/db/schema";
import { uuidv7 } from "@/lib/uuid";
import { hashPassword } from "@/server/auth/password";
import { createCourse } from "@/server/services/golf-course";
import { validateLogo, MAX_LOGO_BYTES } from "@/server/services/logo-upload";
import { resetDb } from "../helpers/reset-db";

/** Scenario V-1 (volet validation) — FR-004, FR-003. */

let adminId: string;

beforeEach(async () => {
  await resetDb();
  adminId = uuidv7();
  await db.insert(account).values({
    id: adminId,
    email: `admin.${adminId}@example.invalid`,
    firstName: "Amina",
    lastName: "Exemple",
    passwordHash: await hashPassword("MotDePasseFictif1!"),
  });
});

describe("validation d'un terrain (FR-004)", () => {
  it("refuse un nom manquant en le nommant explicitement", async () => {
    await expect(
      createCourse(adminId, { name: "  ", timezone: "Africa/Casablanca" }),
    ).rejects.toThrow(/nom du terrain est obligatoire/);
  });

  it("refuse un fuseau horaire manquant", async () => {
    await expect(createCourse(adminId, { name: "Terrain", timezone: "" })).rejects.toThrow(
      /fuseau horaire est obligatoire/,
    );
  });

  it("refuse un fuseau horaire inconnu", async () => {
    await expect(
      createCourse(adminId, { name: "Terrain", timezone: "Pas/UnFuseau" }),
    ).rejects.toThrow(/Fuseau horaire inconnu/);
  });

  it("refuse une couleur hors format hexadecimal", async () => {
    await expect(
      createCourse(adminId, {
        name: "Terrain",
        timezone: "Africa/Casablanca",
        brandColorPrimary: "vert",
      }),
    ).rejects.toThrow(/hexadécimal/);
  });

  it("refuse un lien d'avis qui n'est pas en https", async () => {
    await expect(
      createCourse(adminId, {
        name: "Terrain",
        timezone: "Africa/Casablanca",
        googleReviewUrl: "http://example.invalid/avis",
      }),
    ).rejects.toThrow(/https/);
  });

  it("accepte un terrain complet et valide", async () => {
    const id = await createCourse(adminId, {
      name: "Golf des Cèdres",
      address: "Route Fictive 1",
      timezone: "Africa/Casablanca",
      brandColorPrimary: "#1b4d3e",
      googleReviewUrl: "https://example.invalid/avis/cedres",
    });
    expect(id).toMatch(/^[0-9a-f-]{36}$/);
  });
});

describe("validation du logo (FR-003)", () => {
  it("accepte les formats prevus", () => {
    expect(() => validateLogo({ type: "image/png", size: 1024 })).not.toThrow();
    expect(() => validateLogo({ type: "image/svg+xml", size: 2048 })).not.toThrow();
  });

  it("refuse un format non pris en charge, explicitement", () => {
    expect(() => validateLogo({ type: "application/pdf", size: 1024 })).toThrow(
      /Format non pris en charge/,
    );
  });

  it("refuse un fichier trop volumineux en indiquant la limite", () => {
    expect(() => validateLogo({ type: "image/png", size: MAX_LOGO_BYTES + 1 })).toThrow(
      /Maximum : 512 Ko/,
    );
  });
});
