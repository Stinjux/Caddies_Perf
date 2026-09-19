import { describe, it, expect, beforeEach } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "../helpers/raw-db";
import { cart } from "@/db/schema";
import {
  createCart,
  setCartStatus,
  listCarts,
  listCartsForStarter,
  findCartByToken,
  genererJetonQr,
} from "@/server/services/cart";
import { createCaddie, setCaddieStatus, setCaddieAvailability } from "@/server/services/caddie";
import { listCaddiesForStarter } from "@/server/repositories/caddie";
import { urlEvaluation } from "@/lib/qr";
import { resetDb } from "../helpers/reset-db";
import { testScope } from "../helpers/scope";
import { makeCourse, makeAccount } from "../helpers/fixtures";

let cedres: string;
let atlas: string;
let adminId: string;

beforeEach(async () => {
  await resetDb();
  cedres = await makeCourse("Golf des Cèdres");
  atlas = await makeCourse("Royal Atlas");
  adminId = await makeAccount({
    links: [
      { courseId: cedres, role: "admin" },
      { courseId: atlas, role: "admin" },
    ],
  });
});

const admin = (c = cedres) => testScope({ accountId: adminId, golfCourseId: c, role: "admin" });
const starter = (c = cedres) => testScope({ accountId: adminId, golfCourseId: c, role: "starter" });

describe("jeton de QR code (FR-031)", () => {
  it("est long, opaque et non devinable", () => {
    const jeton = genererJetonQr();
    expect(jeton.length).toBeGreaterThanOrEqual(43);
    expect(jeton).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("ne se répète jamais", () => {
    const set = new Set(Array.from({ length: 500 }, genererJetonQr));
    expect(set.size).toBe(500);
  });

  it("ne contient aucune donnée du terrain ni du numéro visible", async () => {
    await createCart(admin(), "12");
    const rows = await db.select().from(cart).where(eq(cart.golfCourseId, cedres));
    expect(rows[0]!.qrToken).not.toContain("12");
    expect(rows[0]!.qrToken).not.toContain(cedres.slice(0, 8));
  });

  it("produit une adresse qui ne porte que le jeton", async () => {
    await createCart(admin(), "12");
    const rows = await db.select().from(cart).where(eq(cart.golfCourseId, cedres));
    const url = urlEvaluation("https://exemple.invalid", rows[0]!.qrToken);

    expect(url).toBe(`https://exemple.invalid/e/${rows[0]!.qrToken}`);
    expect(url).not.toContain("12");
    expect(url).not.toContain(cedres);
  });

  it("est PERMANENT : il survit à la mise en entretien", async () => {
    const id = await createCart(admin(), "12");
    const avant = (await db.select().from(cart).where(eq(cart.id, id)))[0]!.qrToken;

    await setCartStatus(admin(), id, "maintenance");
    await setCartStatus(admin(), id, "inactive");
    await setCartStatus(admin(), id, "available");

    const apres = (await db.select().from(cart).where(eq(cart.id, id)))[0]!.qrToken;
    expect(apres).toBe(avant);
  });
});

describe("parc de voiturettes", () => {
  it("refuse deux fois le même numéro visible sur un terrain", async () => {
    await createCart(admin(), "12");
    await expect(createCart(admin(), "12")).rejects.toThrow(/déjà utilisé/);
  });

  it("autorise le même numéro sur deux terrains distincts", async () => {
    await createCart(admin(cedres), "12");
    await expect(createCart(admin(atlas), "12")).resolves.toMatch(/^[0-9a-f-]{36}$/);
  });

  it("refuse un numéro vide", async () => {
    await expect(createCart(admin(), "  ")).rejects.toThrow(/obligatoire/);
  });

  it("ne liste que les voiturettes du terrain actif", async () => {
    await createCart(admin(cedres), "12");
    await createCart(admin(atlas), "01");

    expect((await listCarts(admin(cedres))).map((c) => c.visibleNumber)).toEqual(["12"]);
    expect((await listCarts(admin(atlas))).map((c) => c.visibleNumber)).toEqual(["01"]);
  });

  it("interdit la création à un Starter", async () => {
    await expect(createCart(starter(), "12")).rejects.toThrow(/droits/);
  });

  it("autorise le Starter à signaler une indisponibilité (FR-019)", async () => {
    const id = await createCart(admin(), "12");
    await expect(setCartStatus(starter(), id, "maintenance")).resolves.toBeUndefined();
  });

  it("traite une voiturette d'un autre terrain comme inexistante", async () => {
    const id = await createCart(admin(atlas), "01");
    await expect(setCartStatus(admin(cedres), id, "maintenance")).rejects.toThrow(/introuvable/);
  });
});

describe("vue du Starter : aucun jeton de QR code (FR-020)", () => {
  it("n'expose jamais le jeton dans la liste des voiturettes", async () => {
    await createCart(admin(), "12");
    const vue = await listCartsForStarter(admin());

    expect(Object.keys(vue[0]!)).toEqual(["id", "visibleNumber", "status"]);
    expect(JSON.stringify(vue)).not.toContain("qrToken");
  });

  it("n'expose du caddie que les champs autorisés", async () => {
    await createCaddie(admin(), {
      internalRef: "C-0001",
      firstName: "Hassan",
      lastName: "Fictif",
      seniorityYears: 6,
    });
    const vue = await listCaddiesForStarter(admin());

    expect(Object.keys(vue[0]!).sort()).toEqual([
      "available",
      "firstName",
      "id",
      "internalRef",
      "lastName",
    ]);
    expect(JSON.stringify(vue)).not.toContain("seniority");
  });
});

describe("résolution d'un jeton scanné", () => {
  it("retrouve la voiturette par son jeton", async () => {
    const id = await createCart(admin(), "12");
    const jeton = (await db.select().from(cart).where(eq(cart.id, id)))[0]!.qrToken;

    expect((await findCartByToken(jeton))?.id).toBe(id);
  });

  it("ne remonte rien pour un jeton inconnu ou tronqué", async () => {
    expect(await findCartByToken("jeton-inexistant-mais-assez-long-pour-passer")).toBeNull();
    expect(await findCartByToken("court")).toBeNull();
    expect(await findCartByToken("")).toBeNull();
  });
});

describe("cycle de vie du caddie", () => {
  it("désactive un caddie et conserve son identité (FR-042)", async () => {
    const id = await createCaddie(admin(), {
      internalRef: "C-0001",
      firstName: "Hassan",
      lastName: "Fictif",
    });
    await setCaddieStatus(admin(), id, "disabled", 1);

    const vue = await listCaddiesForStarter(admin());
    expect(vue).toEqual([]);
  });

  it("distingue l'indisponibilité du moment de la désactivation (FR-049)", async () => {
    const id = await createCaddie(admin(), {
      internalRef: "C-0001",
      firstName: "Hassan",
      lastName: "Fictif",
    });

    await setCaddieAvailability(starter(), id, "unavailable");

    const vue = await listCaddiesForStarter(admin());
    expect(vue).toHaveLength(1);
    expect(vue[0]?.available).toBe(false);
  });

  it("refuse deux caddies de même identifiant interne sur un terrain", async () => {
    await createCaddie(admin(), { internalRef: "C-0001", firstName: "Hassan", lastName: "Fictif" });
    await expect(
      createCaddie(admin(), { internalRef: "C-0001", firstName: "Omar", lastName: "Fictif" }),
    ).rejects.toThrow(/déjà utilisé/);
  });

  it("interdit au Starter de créer ou modifier un caddie", async () => {
    await expect(
      createCaddie(starter(), { internalRef: "C-9", firstName: "X", lastName: "Y" }),
    ).rejects.toThrow(/droits/);
  });
});
